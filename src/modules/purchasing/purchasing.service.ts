import { Injectable } from '@nitrostack/core';
import { DatabaseService } from '../database/database.service.js';
import { ObjectId } from 'mongodb';
import { Sku, Movement } from '../inventory/inventory.service.js';

export interface Contract {
  _id?: ObjectId;
  sku: string;
  quantity: number;
  warehouseId: string;
  supplierId: string | null;
  supplierName: string | null;
  status: 'REQUESTED' | 'TAKEN' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'RECEIVED';
  createdBy: string; // The manager's userId/subject
  approvedBy?: string; // The manager who approved the supplier's take
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({ deps: [DatabaseService] })
export class PurchasingService {
  constructor(private readonly db: DatabaseService) {}

  private get contracts() { return this.db.getDb().collection<Contract>('contracts'); }
  private get skus() { return this.db.getDb().collection<Sku>('skus'); }
  private get movements() { return this.db.getDb().collection<Movement>('movements'); }

  async requestStock(skuCode: string, quantity: number, warehouseId: string, managerId: string) {
    const sku = await this.skus.findOne({ sku: skuCode });
    if (!sku) {
      throw new Error(`SKU ${skuCode} not found in catalog.`);
    }

    const locExists = sku.locations.some(l => l.warehouseId === warehouseId);
    if (!locExists) {
      throw new Error(`SKU ${skuCode} is not stocked in warehouse ${warehouseId}.`);
    }

    const contract: Contract = {
      sku: skuCode,
      quantity,
      warehouseId,
      supplierId: null,
      supplierName: null,
      status: 'REQUESTED',
      createdBy: managerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.contracts.insertOne(contract);
    return { ...contract, _id: result.insertedId };
  }

  async listPendingContracts() {
    return this.contracts.find({ status: 'TAKEN' }).toArray();
  }

  async approveContract(contractId: string, managerId: string) {
    const objectId = new ObjectId(contractId);
    const contract = await this.contracts.findOne({ _id: objectId });
    if (!contract) throw new Error('Contract not found.');
    if (contract.status !== 'TAKEN') {
      throw new Error(`Only TAKEN contracts can be approved. Current status: ${contract.status}`);
    }

    await this.contracts.updateOne(
      { _id: objectId },
      { $set: { status: 'APPROVED', approvedBy: managerId, updatedAt: new Date() } }
    );

    // Also update SKU preferred supplier and unit cost if supplier is active
    // Wait, let's just mark the contract as approved.
    return { success: true, message: `Contract approved by manager ${managerId}.` };
  }

  async rejectContract(contractId: string) {
    const objectId = new ObjectId(contractId);
    const contract = await this.contracts.findOne({ _id: objectId });
    if (!contract) throw new Error('Contract not found.');
    if (contract.status !== 'TAKEN') {
      throw new Error(`Only TAKEN contracts can be rejected. Current status: ${contract.status}`);
    }

    // Reset status back to REQUESTED and clear supplier info so other suppliers can take it
    await this.contracts.updateOne(
      { _id: objectId },
      { $set: { status: 'REQUESTED', supplierId: null, supplierName: null, updatedAt: new Date() } }
    );

    return { success: true, message: 'Contract rejected and returned to REQUESTED status.' };
  }

  async cancelContract(contractId: string) {
    const objectId = new ObjectId(contractId);
    const contract = await this.contracts.findOne({ _id: objectId });
    if (!contract) throw new Error('Contract not found.');
    if (['RECEIVED', 'CANCELLED'].includes(contract.status)) {
      throw new Error(`Cannot cancel contract in status: ${contract.status}`);
    }

    await this.contracts.updateOne(
      { _id: objectId },
      { $set: { status: 'CANCELLED', updatedAt: new Date() } }
    );

    return { success: true, message: 'Contract successfully cancelled.' };
  }

  async receiveContract(contractId: string, warehouseId: string) {
    const objectId = new ObjectId(contractId);
    const session = this.db.getClient().startSession();

    try {
      let result;
      await session.withTransaction(async () => {
        const contract = await this.contracts.findOne({ _id: objectId }, { session });
        if (!contract) throw new Error('Contract not found.');
        if (contract.status !== 'APPROVED') {
          throw new Error(`Only APPROVED contracts can be received. Current status: ${contract.status}`);
        }

        // Update contract status to RECEIVED
        await this.contracts.updateOne(
          { _id: objectId },
          { $set: { status: 'RECEIVED', updatedAt: new Date() } },
          { session }
        );

        // Find the SKU to verify it exists
        const sku = await this.skus.findOne({ sku: contract.sku }, { session });
        if (!sku) throw new Error(`SKU ${contract.sku} not found.`);

        const locIndex = sku.locations.findIndex(l => l.warehouseId === warehouseId);
        if (locIndex === -1) {
          throw new Error(`SKU ${contract.sku} not configured for warehouse ${warehouseId}.`);
        }

        // Update stock levels
        await this.skus.updateOne(
          { sku: contract.sku, 'locations.warehouseId': warehouseId },
          {
            $inc: {
              onHand: contract.quantity,
              'locations.$.onHand': contract.quantity,
            },
          },
          { session }
        );

        // Record the stock receipt movement
        const movement: Movement = {
          sku: contract.sku,
          type: 'RECEIPT',
          toWarehouseId: warehouseId,
          quantity: contract.quantity,
          reason: `Contract Fulfillment for ${contractId}`,
          timestamp: new Date(),
        };

        await this.movements.insertOne(movement, { session });
        result = { success: true, message: `Contract received successfully. Added ${contract.quantity} units to ${warehouseId}.` };
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  // Manager proposal approval
  async approveProposal(proposalId: string) {
    const objectId = new ObjectId(proposalId);
    const proposalColl = this.db.getDb().collection('proposals');
    const proposal = await proposalColl.findOne({ _id: objectId });
    if (!proposal) throw new Error('Proposal not found.');
    if (proposal.status !== 'PENDING') {
      throw new Error(`Proposal is not pending (current status: ${proposal.status}).`);
    }

    await proposalColl.updateOne(
      { _id: objectId },
      { $set: { status: 'APPROVED' } }
    );

    // Register SKU in inventory if it does not already exist
    const sku = await this.skus.findOne({ sku: proposal.sku });
    if (!sku) {
      const locations = ['WH-MAIN']; // Default warehouse location
      const newSkuData = {
        sku: proposal.sku,
        description: proposal.description,
        reorderPoint: 10,
        reorderQuantity: 50,
        preferredSupplierId: proposal.supplierId,
        unitCost: proposal.unitCost,
        locations,
      };
      // Let's invoke the inventory service method or register it directly
      const locationsArray = locations.map(warehouseId => ({ warehouseId, onHand: 0, reserved: 0 }));
      await this.skus.insertOne({
        sku: newSkuData.sku,
        description: newSkuData.description,
        onHand: 0,
        reserved: 0,
        reorderPoint: newSkuData.reorderPoint,
        reorderQuantity: newSkuData.reorderQuantity,
        preferredSupplierId: newSkuData.preferredSupplierId,
        unitCost: newSkuData.unitCost,
        locations: locationsArray,
      });
    } else {
      // Update unitCost and preferred supplier
      await this.skus.updateOne(
        { sku: proposal.sku },
        {
          $set: {
            preferredSupplierId: proposal.supplierId,
            unitCost: proposal.unitCost,
          },
        }
      );
    }

    return { success: true, message: 'Proposal approved. SKU updated in catalog.' };
  }
}
