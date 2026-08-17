import { Injectable } from '@nitrostack/core';
import { DatabaseService } from '../database/database.service.js';
import { ObjectId } from 'mongodb';

export interface Supplier {
  _id?: ObjectId;
  userId: string; // The authenticated subject/user ID of the supplier
  companyName: string;
  contactEmail: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
}

export interface Proposal {
  _id?: ObjectId;
  supplierId: string; // The supplier's userId
  supplierName?: string;
  neededStockId: string;
  warehouseId: string;
  sku: string;
  description: string;
  bulkQuantity: number;
  unitCost: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Date;
}

@Injectable({ deps: [DatabaseService] })
export class SupplierService {
  constructor(private readonly db: DatabaseService) {}

  private get collection() {
    return this.db.getDb().collection<Supplier>('suppliers');
  }

  private get proposalCollection() {
    return this.db.getDb().collection<Proposal>('proposals');
  }

  async getProfile(userId: string) {
    return this.collection.findOne({ userId });
  }

  async listVerifiedSuppliers() {
    return this.collection.find({ status: 'ACTIVE' }).toArray();
  }

  async createProfile(userId: string, companyName: string, contactEmail: string) {
    const existing = await this.collection.findOne({ userId });
    if (existing) {
      throw new Error('Supplier profile already exists for this user.');
    }

    const supplier: Supplier = {
      userId,
      companyName,
      contactEmail,
      status: 'ACTIVE',
      createdAt: new Date(),
    };

    const result = await this.collection.insertOne(supplier);
    return { ...supplier, _id: result.insertedId };
  }

  async submitProposal(userId: string, neededStockId: string, warehouseId: string, bulkQuantity: number, unitCost: number) {
    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new Error('No supplier profile found. Please create your profile first.');
    }

    // Validate neededStockId
    const neededStockColl = this.db.getDb().collection('needed_stocks');
    const neededStock = await neededStockColl.findOne({ _id: new ObjectId(neededStockId) });
    if (!neededStock) {
      throw new Error(`Needed stock requirement with ID ${neededStockId} not found.`);
    }
    if (neededStock.status !== 'OPEN') {
      throw new Error(`This stock requirement is already fulfilled.`);
    }

    // Validate warehouseId
    const warehouseColl = this.db.getDb().collection('warehouses');
    const warehouse = await warehouseColl.findOne({ warehouseId });
    if (!warehouse) {
      throw new Error(`Warehouse ${warehouseId} does not exist.`);
    }
    if (neededStock.warehouseId !== warehouseId) {
      throw new Error(`Warehouse mismatch: Requirement is for ${neededStock.warehouseId}, but proposal is for ${warehouseId}.`);
    }

    const proposal: Proposal = {
      supplierId: userId,
      supplierName: profile.companyName,
      neededStockId: neededStockId,
      warehouseId: warehouseId,
      sku: neededStock.sku,
      description: `Proposal for needed stock ${neededStockId}`,
      bulkQuantity,
      unitCost,
      status: 'PENDING',
      createdAt: new Date(),
    };

    const result = await this.proposalCollection.insertOne(proposal);
    return { ...proposal, _id: result.insertedId };
  }
}
