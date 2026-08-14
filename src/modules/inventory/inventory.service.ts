import { Injectable, emitEvent } from '@nitrostack/core';
import { DatabaseService } from '../database/database.service.js';
import { ObjectId } from 'mongodb';

export interface SkuLocation {
  warehouseId: string;
  onHand: number;
  reserved: number;
}

export interface CycleCount {
  _id?: ObjectId;
  sku: string;
  warehouseId: string;
  expectedQuantity: number;
  actualQuantity?: number;
  variance?: number;
  status: 'STARTED' | 'COUNTED' | 'REVIEW_PENDING' | 'APPROVED';
  startedAt: Date;
  countedAt?: Date;
  varianceReason?: string;
}

export interface Sku {
  _id?: ObjectId;
  sku: string;
  description: string;
  onHand: number;
  reserved: number;
  reorderPoint: number;
  reorderQuantity: number;
  preferredSupplierId: string;
  locations: SkuLocation[];
}

export interface Movement {
  _id?: ObjectId;
  sku: string;
  type: 'ADJUSTMENT' | 'TRANSFER' | 'RECEIPT' | 'CYCLE_COUNT';
  fromWarehouseId?: string;
  toWarehouseId?: string;
  quantity: number;
  reason?: string;
  timestamp: Date;
}

@Injectable({ deps: [DatabaseService] })
export class InventoryService {
  constructor(private readonly db: DatabaseService) {}

  private get skus() { return this.db.getDb().collection<Sku>('skus'); }
  private get movements() { return this.db.getDb().collection<Movement>('movements'); }
  private get cycleCounts() { return this.db.getDb().collection<CycleCount>('cycle_counts'); }

  async getStockLevel(skuCode: string, warehouseId?: string) {
    const sku = await this.skus.findOne({ sku: skuCode });
    if (!sku) throw new Error(`SKU ${skuCode} not found`);

    if (warehouseId) {
      const loc = sku.locations.find(l => l.warehouseId === warehouseId);
      if (!loc) throw new Error(`SKU ${skuCode} not found in warehouse ${warehouseId}`);
      return { onHand: loc.onHand, reserved: loc.reserved, available: loc.onHand - loc.reserved };
    }

    return { onHand: sku.onHand, reserved: sku.reserved, available: sku.onHand - sku.reserved };
  }

  async listLowStockSkus() {
    const allSkus = await this.skus.find({}).toArray();
    return allSkus.filter(s => (s.onHand - s.reserved) <= s.reorderPoint);
  }

  async registerSku(data: Omit<Sku, '_id' | 'locations' | 'onHand' | 'reserved'> & { locations: string[] }) {
    const locations: SkuLocation[] = data.locations.map(warehouseId => ({ warehouseId, onHand: 0, reserved: 0 }));
    const newSku: Sku = {
      ...data,
      onHand: 0,
      reserved: 0,
      locations
    };
    await this.skus.insertOne(newSku);
    return newSku;
  }

  async adjustStock(skuCode: string, warehouseId: string, quantity: number, reason: string) {
    const session = this.db.getClient().startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const sku = await this.skus.findOne({ sku: skuCode }, { session });
        if (!sku) throw new Error(`SKU ${skuCode} not found`);

        const locIndex = sku.locations.findIndex(l => l.warehouseId === warehouseId);
        if (locIndex === -1) throw new Error(`SKU ${skuCode} not found in warehouse ${warehouseId}`);

        const currentAvailable = sku.locations[locIndex].onHand - sku.locations[locIndex].reserved;
        if (currentAvailable + quantity < 0) {
          throw new Error(`Insufficient available stock for SKU ${skuCode} in warehouse ${warehouseId}. Cannot adjust by ${quantity}.`);
        }

        const updateResult = await this.skus.updateOne(
          { sku: skuCode, 'locations.warehouseId': warehouseId },
          {
            $inc: {
              onHand: quantity,
              'locations.$.onHand': quantity
            }
          },
          { session }
        );

        if (updateResult.modifiedCount === 0) {
          throw new Error('Stock update failed.');
        }

        const movement: Movement = {
          sku: skuCode,
          type: 'ADJUSTMENT',
          fromWarehouseId: quantity < 0 ? warehouseId : undefined,
          toWarehouseId: quantity > 0 ? warehouseId : undefined,
          quantity: Math.abs(quantity),
          reason,
          timestamp: new Date()
        };
        await this.movements.insertOne(movement, { session });
        result = movement;
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async transferStock(skuCode: string, fromWarehouseId: string, toWarehouseId: string, quantity: number) {
    if (quantity <= 0) throw new Error('Transfer quantity must be positive.');
    if (fromWarehouseId === toWarehouseId) throw new Error('Cannot transfer to the same warehouse.');

    const session = this.db.getClient().startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const sku = await this.skus.findOne({ sku: skuCode }, { session });
        if (!sku) throw new Error(`SKU ${skuCode} not found`);

        const fromLoc = sku.locations.find(l => l.warehouseId === fromWarehouseId);
        const toLocIndex = sku.locations.findIndex(l => l.warehouseId === toWarehouseId);

        if (!fromLoc) throw new Error(`SKU ${skuCode} not in source warehouse ${fromWarehouseId}`);
        if (toLocIndex === -1) throw new Error(`SKU ${skuCode} not in target warehouse ${toWarehouseId}`);

        const fromAvailable = fromLoc.onHand - fromLoc.reserved;
        if (fromAvailable < quantity) {
          throw new Error(`Insufficient stock in ${fromWarehouseId} to transfer ${quantity} of ${skuCode}. Only ${fromAvailable} available.`);
        }

        await this.skus.updateOne(
          { sku: skuCode, 'locations.warehouseId': fromWarehouseId },
          { $inc: { 'locations.$.onHand': -quantity } },
          { session }
        );

        await this.skus.updateOne(
          { sku: skuCode, 'locations.warehouseId': toWarehouseId },
          { $inc: { 'locations.$.onHand': quantity } },
          { session }
        );

        const movement: Movement = {
          sku: skuCode,
          type: 'TRANSFER',
          fromWarehouseId,
          toWarehouseId,
          quantity,
          timestamp: new Date()
        };
        await this.movements.insertOne(movement, { session });
        result = movement;
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async startCycleCount(skuCode: string, warehouseId: string) {
    const sku = await this.skus.findOne({ sku: skuCode });
    if (!sku) throw new Error(`SKU ${skuCode} not found.`);

    const loc = sku.locations.find(l => l.warehouseId === warehouseId);
    if (!loc) throw new Error(`SKU ${skuCode} not found in warehouse ${warehouseId}.`);

    const cycleCount: CycleCount = {
      sku: skuCode,
      warehouseId,
      expectedQuantity: loc.onHand, // Including reserved as they physically exist
      status: 'STARTED',
      startedAt: new Date()
    };

    await this.cycleCounts.insertOne(cycleCount);
    return cycleCount;
  }

  async recordCycleCount(countId: string, actualQuantity: number) {
    const objectId = new ObjectId(countId);
    const session = this.db.getClient().startSession();

    try {
      let result;
      await session.withTransaction(async () => {
        const count = await this.cycleCounts.findOne({ _id: objectId }, { session });
        if (!count) throw new Error('Cycle count not found.');
        if (count.status !== 'STARTED') throw new Error('Only STARTED cycle counts can be recorded.');

        const variance = actualQuantity - count.expectedQuantity;
        const newStatus = 'COUNTED';

        await this.cycleCounts.updateOne(
          { _id: objectId },
          { $set: { actualQuantity, variance, status: newStatus, countedAt: new Date() } },
          { session }
        );

        if (variance !== 0) {
          // Auto-adjust for any variance
          await this.skus.updateOne(
            { sku: count.sku, 'locations.warehouseId': count.warehouseId },
            { $inc: { onHand: variance, 'locations.$.onHand': variance } },
            { session }
          );

          const movement: Movement = {
            sku: count.sku,
            type: 'CYCLE_COUNT',
            toWarehouseId: count.warehouseId,
            quantity: Math.abs(variance), // Keep quantity positive
            reason: `Auto-adjusted from Cycle Count ${countId}`,
            timestamp: new Date()
          };
          // For movement, we should know if it's adding or removing
          // If variance is positive, we add to warehouse (toWarehouseId)
          // If variance is negative, we remove from warehouse (fromWarehouseId)
          if (variance < 0) {
              movement.fromWarehouseId = count.warehouseId;
              delete movement.toWarehouseId;
          }

          await this.movements.insertOne(movement, { session });
        }

        result = { success: true, variance, status: newStatus };
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
}
