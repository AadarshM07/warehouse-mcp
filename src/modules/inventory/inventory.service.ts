import { Injectable, emitEvent } from '@nitrostack/core';
import { DatabaseService } from '../database/database.service.js';
import { ObjectId } from 'mongodb';

export interface SkuLocation {
  warehouseId: string;
  onHand: number;
  reserved: number;
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
  unitCost?: number;
}

export interface Movement {
  _id?: ObjectId;
  sku: string;
  type: 'ADJUSTMENT' | 'TRANSFER' | 'RECEIPT';
  fromWarehouseId?: string;
  toWarehouseId?: string;
  quantity: number;
  reason?: string;
  timestamp: Date;
}

export interface Warehouse {
  _id?: ObjectId;
  warehouseId: string;
  name: string;
  location: string;
}

@Injectable({ deps: [DatabaseService] })
export class InventoryService {
  constructor(private readonly db: DatabaseService) {}

  private get skus() { return this.db.getDb().collection<Sku>('skus'); }
  private get movements() { return this.db.getDb().collection<Movement>('movements'); }
  private get warehouses() { return this.db.getDb().collection<Warehouse>('warehouses'); }

  async getAllSkus() {
    return this.skus.find({}).toArray();
  }

  async createWarehouse(warehouseId: string, name: string, location: string) {
    const existing = await this.warehouses.findOne({ warehouseId });
    if (existing) {
      throw new Error(`Warehouse with ID ${warehouseId} already exists.`);
    }
    const warehouse: Warehouse = {
      warehouseId,
      name,
      location
    };
    await this.warehouses.insertOne(warehouse);
    return warehouse;
  }

  async listWarehouses() {
    return this.warehouses.find({}).toArray();
  }

  async getStockLevel(skuCode: string, warehouseId?: string) {
    const sku = await this.skus.findOne({ sku: skuCode });
    if (!sku) throw new Error(`SKU ${skuCode} not found`);

    if (warehouseId) {
      const exists = await this.warehouses.findOne({ warehouseId });
      if (!exists) throw new Error(`Warehouse ${warehouseId} does not exist.`);

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

  async registerSku(data: Omit<Sku, '_id' | 'locations' | 'onHand' | 'reserved' | 'preferredSupplierId'> & { locations: string[] }) {
    for (const warehouseId of data.locations) {
      const exists = await this.warehouses.findOne({ warehouseId });
      if (!exists) {
        throw new Error(`Warehouse ${warehouseId} does not exist.`);
      }
    }

    const locations: SkuLocation[] = data.locations.map(warehouseId => ({ warehouseId, onHand: 0, reserved: 0 }));
    const newSku: Sku = {
      ...data,
      preferredSupplierId: '',
      onHand: 0,
      reserved: 0,
      locations
    };
    await this.skus.insertOne(newSku);
    return newSku;
  }

  async adjustStock(skuCode: string, warehouseId: string, quantity: number, reason: string) {
    const whExists = await this.warehouses.findOne({ warehouseId: { $regex: new RegExp(`^${warehouseId}$`, 'i') } });
    if (!whExists) throw new Error(`Warehouse ${warehouseId} does not exist.`);
    const normalizedWarehouseId = whExists.warehouseId;

    const session = this.db.getClient().startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const sku = await this.skus.findOne({ sku: skuCode }, { session });
        if (!sku) throw new Error(`SKU ${skuCode} not found`);

        const locIndex = sku.locations.findIndex(l => l.warehouseId.toLowerCase() === normalizedWarehouseId.toLowerCase());
        if (locIndex === -1) throw new Error(`SKU ${skuCode} not found in warehouse ${normalizedWarehouseId}`);

        const currentAvailable = sku.locations[locIndex].onHand - sku.locations[locIndex].reserved;
        if (currentAvailable + quantity < 0) {
          throw new Error(`Insufficient available stock for SKU ${skuCode} in warehouse ${normalizedWarehouseId}. Cannot adjust by ${quantity}.`);
        }

        const updateResult = await this.skus.updateOne(
          { sku: skuCode, 'locations.warehouseId': sku.locations[locIndex].warehouseId },
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
          fromWarehouseId: quantity < 0 ? sku.locations[locIndex].warehouseId : undefined,
          toWarehouseId: quantity > 0 ? sku.locations[locIndex].warehouseId : undefined,
          quantity: Math.abs(quantity),
          reason,
          timestamp: new Date()
        };
        await this.movements.insertOne(movement, { session });

        await this.checkAndTriggerReorder(skuCode, sku.locations[locIndex].warehouseId, session);

        result = movement;
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async transferStock(skuCode: string, fromWarehouseId: string, toWarehouseId: string, quantity: number) {
    if (quantity <= 0) throw new Error('Transfer quantity must be positive.');

    const fromExists = await this.warehouses.findOne({ warehouseId: { $regex: new RegExp(`^${fromWarehouseId}$`, 'i') } });
    if (!fromExists) throw new Error(`Source warehouse ${fromWarehouseId} does not exist.`);
    const normalizedFromId = fromExists.warehouseId;

    const toExists = await this.warehouses.findOne({ warehouseId: { $regex: new RegExp(`^${toWarehouseId}$`, 'i') } });
    if (!toExists) throw new Error(`Target warehouse ${toWarehouseId} does not exist.`);
    const normalizedToId = toExists.warehouseId;

    if (normalizedFromId === normalizedToId) throw new Error('Cannot transfer to the same warehouse.');

    const session = this.db.getClient().startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const sku = await this.skus.findOne({ sku: skuCode }, { session });
        if (!sku) throw new Error(`SKU ${skuCode} not found`);

        const fromLoc = sku.locations.find(l => l.warehouseId.toLowerCase() === normalizedFromId.toLowerCase());
        
        if (!fromLoc) throw new Error(`SKU ${skuCode} not in source warehouse ${normalizedFromId}`);

        let toLocIndex = sku.locations.findIndex(l => l.warehouseId.toLowerCase() === normalizedToId.toLowerCase());
        if (toLocIndex === -1) {
          // Dynamic target warehouse registration (safety layer fix)
          await this.skus.updateOne(
            { sku: skuCode },
            { $push: { locations: { warehouseId: normalizedToId, onHand: 0, reserved: 0 } } },
            { session }
          );
          sku.locations.push({ warehouseId: normalizedToId, onHand: 0, reserved: 0 });
          toLocIndex = sku.locations.length - 1;
        }

        const fromAvailable = fromLoc.onHand - fromLoc.reserved;
        if (fromAvailable < quantity) {
          throw new Error(`Insufficient stock in ${normalizedFromId} to transfer ${quantity} of ${skuCode}. Only ${fromAvailable} available.`);
        }

        await this.skus.updateOne(
          { sku: skuCode, 'locations.warehouseId': fromLoc.warehouseId },
          { $inc: { 'locations.$.onHand': -quantity } },
          { session }
        );

        await this.skus.updateOne(
          { sku: skuCode, 'locations.warehouseId': sku.locations[toLocIndex].warehouseId },
          { $inc: { 'locations.$.onHand': quantity } },
          { session }
        );

        const movement: Movement = {
          sku: skuCode,
          type: 'TRANSFER',
          fromWarehouseId: fromLoc.warehouseId,
          toWarehouseId: sku.locations[toLocIndex].warehouseId,
          quantity,
          timestamp: new Date()
        };
        await this.movements.insertOne(movement, { session });

        // Trigger automatic reorder check at the source warehouse since stock was reduced
        await this.checkAndTriggerReorder(skuCode, fromLoc.warehouseId, session);

        result = movement;
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async checkAndTriggerReorder(skuCode: string, warehouseId: string, session?: any) {
    const sku = await this.skus.findOne({ sku: skuCode }, { session });
    if (!sku) return;

    const available = sku.onHand - sku.reserved;
    if (sku.reorderPoint !== undefined && available <= sku.reorderPoint && sku.preferredSupplierId) {
      const contractColl = this.db.getDb().collection('reorder_contracts');
      const contract = await contractColl.findOne({
        sku: skuCode,
        supplierId: sku.preferredSupplierId,
        status: 'APPROVED'
      }, { session });

      if (contract) {
        const qty = sku.reorderQuantity || contract.reorderQuantity || 50;
        console.error(`[AUTO-REORDER] Triggered for SKU ${skuCode} in warehouse ${warehouseId}. Current available: ${available}, reorder point: ${sku.reorderPoint}. Auto-ordering ${qty} units.`);
        
        await this.skus.updateOne(
          { sku: skuCode, 'locations.warehouseId': warehouseId },
          {
            $inc: {
              onHand: qty,
              'locations.$.onHand': qty
            }
          },
          { session }
        );

        const movement: Movement = {
          sku: skuCode,
          type: 'RECEIPT',
          toWarehouseId: warehouseId,
          quantity: qty,
          reason: `Automatic Reorder (Contract ${contract._id})`,
          timestamp: new Date()
        };
        await this.movements.insertOne(movement, { session });
      }
    }
  }
}

