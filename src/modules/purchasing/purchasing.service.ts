import { Injectable } from '@nitrostack/core';
import { DatabaseService } from '../database/database.service.js';
import { ObjectId } from 'mongodb';
import { Sku, Movement } from '../inventory/inventory.service.js';

export interface NeededStock {
  _id?: ObjectId;
  sku: string;
  quantityNeeded: number;
  unit: string;
  warehouseId: string;
  status: 'OPEN' | 'FULFILLED';
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({ deps: [DatabaseService] })
export class PurchasingService {
  constructor(private readonly db: DatabaseService) {}

  private get skus() { return this.db.getDb().collection<Sku>('skus'); }
  private get movements() { return this.db.getDb().collection<Movement>('movements'); }
  private get neededStocks() { return this.db.getDb().collection<NeededStock>('needed_stocks'); }

  async addNeededStock(sku: string, quantityNeeded: number, unit: string, warehouseId: string) {
    // Validate warehouse
    const warehouseColl = this.db.getDb().collection('warehouses');
    const warehouse = await warehouseColl.findOne({ warehouseId });
    if (!warehouse) {
      throw new Error(`Warehouse ${warehouseId} does not exist.`);
    }

    const needed: NeededStock = {
      sku,
      quantityNeeded,
      unit,
      warehouseId,
      status: 'OPEN',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await this.neededStocks.insertOne(needed);
    return { ...needed, _id: result.insertedId };
  }

  async listNeededStocks() {
    return this.neededStocks.find({}).toArray();
  }

  async listPendingProposals() {
    const proposalColl = this.db.getDb().collection('proposals');
    return proposalColl.find({ status: 'PENDING' }).toArray();
  }

  async rejectProposal(proposalId: string) {
    const objectId = new ObjectId(proposalId);
    const proposalColl = this.db.getDb().collection('proposals');
    const proposal = await proposalColl.findOne({ _id: objectId });
    if (!proposal) throw new Error('Proposal not found.');
    if (proposal.status !== 'PENDING') {
      throw new Error(`Proposal is not pending (current status: ${proposal.status}).`);
    }

    await proposalColl.updateOne(
      { _id: objectId },
      { $set: { status: 'REJECTED' } }
    );

    return { success: true, message: 'Proposal rejected.' };
  }

  async approveProposal(proposalId: string) {
    const objectId = new ObjectId(proposalId);
    const proposalColl = this.db.getDb().collection('proposals');

    const session = this.db.getClient().startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const proposal = await proposalColl.findOne({ _id: objectId }, { session });
        if (!proposal) throw new Error('Proposal not found.');
        if (proposal.status !== 'PENDING') {
          throw new Error(`Proposal is not pending (current status: ${proposal.status}).`);
        }

        // 1. Mark proposal as APPROVED
        await proposalColl.updateOne(
          { _id: objectId },
          { $set: { status: 'APPROVED' } },
          { session }
        );

        // 2. Mark corresponding needed stock as FULFILLED
        if (proposal.neededStockId) {
          const neededStockColl = this.db.getDb().collection('needed_stocks');
          await neededStockColl.updateOne(
            { _id: new ObjectId(proposal.neededStockId) },
            { $set: { status: 'FULFILLED', updatedAt: new Date() } },
            { session }
          );
        }

        const targetWarehouse = proposal.warehouseId || 'WH-MAIN';

        // 3. Register/Update SKU catalog and increase stock
        const sku = await this.skus.findOne({ sku: proposal.sku }, { session });
        if (!sku) {
          const locations = [{ warehouseId: targetWarehouse, onHand: proposal.bulkQuantity, reserved: 0 }];
          await this.skus.insertOne({
            sku: proposal.sku,
            description: proposal.description,
            onHand: proposal.bulkQuantity,
            reserved: 0,
            reorderPoint: 10,
            reorderQuantity: 50,
            preferredSupplierId: proposal.supplierId,
            unitCost: proposal.unitCost,
            locations,
          }, { session });
        } else {
          // Increment overall onHand and update locations
          const hasLocation = sku.locations.some(l => l.warehouseId === targetWarehouse);
          if (hasLocation) {
            await this.skus.updateOne(
              { sku: proposal.sku, 'locations.warehouseId': targetWarehouse },
              {
                $inc: {
                  onHand: proposal.bulkQuantity,
                  'locations.$.onHand': proposal.bulkQuantity,
                },
                $set: {
                  preferredSupplierId: proposal.supplierId,
                  unitCost: proposal.unitCost,
                }
              },
              { session }
            );
          } else {
            await this.skus.updateOne(
              { sku: proposal.sku },
              {
                $inc: {
                  onHand: proposal.bulkQuantity,
                },
                $push: {
                  locations: { warehouseId: targetWarehouse, onHand: proposal.bulkQuantity, reserved: 0 }
                },
                $set: {
                  preferredSupplierId: proposal.supplierId,
                  unitCost: proposal.unitCost,
                }
              },
              { session }
            );
          }
        }

        // 4. Log stock movement
        const movement: Movement = {
          sku: proposal.sku,
          type: 'RECEIPT',
          toWarehouseId: targetWarehouse,
          quantity: proposal.bulkQuantity,
          reason: `Proposal Fulfillment for ${proposalId}`,
          timestamp: new Date(),
        };
        await this.movements.insertOne(movement, { session });

        result = {
          success: true,
          message: `Proposal approved. Registered SKU and added ${proposal.bulkQuantity} units to ${targetWarehouse}.`
        };
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
}

