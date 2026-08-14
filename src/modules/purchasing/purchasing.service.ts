import { Injectable } from '@nitrostack/core';
import { DatabaseService } from '../database/database.service.js';
import { ObjectId } from 'mongodb';
import { Movement, Sku } from '../inventory/inventory.service.js';

export interface PurchaseOrder {
  _id?: ObjectId;
  poNumber: string;
  sku: string;
  supplierId: string;
  quantity: number;
  receivedQuantity: number;
  status: 'DRAFT' | 'APPROVED' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  createdBy: string;
  approvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({ deps: [DatabaseService] })
export class PurchasingService {
  constructor(private readonly db: DatabaseService) {}

  private get pos() { return this.db.getDb().collection<PurchaseOrder>('purchase_orders'); }
  private get skus() { return this.db.getDb().collection<Sku>('skus'); }
  private get movements() { return this.db.getDb().collection<Movement>('movements'); }

  async generateDraftPO(skuCode: string, createdBy: string) {
    const sku = await this.skus.findOne({ sku: skuCode });
    if (!sku) throw new Error(`SKU ${skuCode} not found.`);

    const existing = await this.pos.findOne({
      sku: skuCode,
      status: { $in: ['DRAFT', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] }
    });

    if (existing) {
      throw new Error(`An open PO (${existing.poNumber}) already exists for SKU ${skuCode}.`);
    }

    const po: PurchaseOrder = {
      poNumber: `PO-${Date.now()}`,
      sku: skuCode,
      supplierId: sku.preferredSupplierId,
      quantity: sku.reorderQuantity,
      receivedQuantity: 0,
      status: 'DRAFT',
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.pos.insertOne(po);
    return po;
  }

  async approvePO(poId: string, approvedBy: string) {
    const objectId = new ObjectId(poId);
    const po = await this.pos.findOne({ _id: objectId });
    if (!po) throw new Error('PO not found.');
    if (po.status !== 'DRAFT') throw new Error('Only DRAFT POs can be approved.');
    if (po.createdBy === approvedBy) throw new Error('A PO cannot be approved by its creator.');

    await this.pos.updateOne(
      { _id: objectId },
      { $set: { status: 'APPROVED', approvedBy, updatedAt: new Date() } }
    );
    return { success: true, message: 'PO approved.' };
  }

  async sendPO(poId: string) {
    const objectId = new ObjectId(poId);
    const po = await this.pos.findOne({ _id: objectId });
    if (!po) throw new Error('PO not found.');
    if (po.status !== 'APPROVED') throw new Error('Only APPROVED POs can be sent.');

    await this.pos.updateOne(
      { _id: objectId },
      { $set: { status: 'SENT', updatedAt: new Date() } }
    );
    return { success: true, message: 'PO sent.' };
  }

  async cancelPO(poId: string) {
    const objectId = new ObjectId(poId);
    const po = await this.pos.findOne({ _id: objectId });
    if (!po) throw new Error('PO not found.');
    if (!['DRAFT', 'APPROVED'].includes(po.status)) throw new Error('Only DRAFT or APPROVED POs can be cancelled.');

    await this.pos.updateOne(
      { _id: objectId },
      { $set: { status: 'CANCELLED', updatedAt: new Date() } }
    );
    return { success: true, message: 'PO cancelled.' };
  }

  async receivePO(poId: string, quantity: number, warehouseId: string, tolerancePercent = 5) {
    const objectId = new ObjectId(poId);
    
    const session = this.db.getClient().startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const po = await this.pos.findOne({ _id: objectId }, { session });
        if (!po) throw new Error('PO not found.');
        if (!['SENT', 'PARTIALLY_RECEIVED'].includes(po.status)) {
          throw new Error('Only SENT or PARTIALLY_RECEIVED POs can be received.');
        }

        const newReceivedTotal = po.receivedQuantity + quantity;
        const maxAllowed = po.quantity * (1 + tolerancePercent / 100);

        if (newReceivedTotal > maxAllowed) {
          throw new Error(`Received quantity exceeds tolerance limit. Max allowed total receipt is ${maxAllowed}.`);
        }

        const newStatus = newReceivedTotal >= po.quantity ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

        await this.pos.updateOne(
          { _id: objectId },
          { $set: { receivedQuantity: newReceivedTotal, status: newStatus, updatedAt: new Date() } },
          { session }
        );

        const sku = await this.skus.findOne({ sku: po.sku }, { session });
        if (!sku) throw new Error(`SKU ${po.sku} not found.`);

        const locIndex = sku.locations.findIndex(l => l.warehouseId === warehouseId);
        if (locIndex === -1) throw new Error(`SKU ${po.sku} not found in warehouse ${warehouseId}.`);

        await this.skus.updateOne(
          { sku: po.sku, 'locations.warehouseId': warehouseId },
          { $inc: { onHand: quantity, 'locations.$.onHand': quantity } },
          { session }
        );

        const movement: Movement = {
          sku: po.sku,
          type: 'RECEIPT',
          toWarehouseId: warehouseId,
          quantity,
          reason: `PO Receipt for ${po.poNumber}`,
          timestamp: new Date()
        };
        await this.movements.insertOne(movement, { session });

        result = { success: true, status: newStatus };
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
}
