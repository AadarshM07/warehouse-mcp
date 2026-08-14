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

  private get contractCollection() {
    return this.db.getDb().collection('contracts');
  }

  async getProfile(userId: string) {
    return this.collection.findOne({ userId });
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

  async submitProposal(userId: string, sku: string, description: string, bulkQuantity: number, unitCost: number) {
    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new Error('No supplier profile found. Please create your profile first.');
    }

    const proposal: Proposal = {
      supplierId: userId,
      sku,
      description,
      bulkQuantity,
      unitCost,
      status: 'PENDING',
      createdAt: new Date(),
    };

    const result = await this.proposalCollection.insertOne(proposal);
    return { ...proposal, _id: result.insertedId };
  }

  async listAvailableContracts() {
    return this.contractCollection.find({ status: 'REQUESTED' }).toArray();
  }

  async takeContract(contractId: string, userId: string) {
    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new Error('No supplier profile found. Please create your profile first.');
    }

    const objectId = new ObjectId(contractId);
    const contract = await this.contractCollection.findOne({ _id: objectId });
    if (!contract) {
      throw new Error('Contract not found.');
    }

    if (contract.status !== 'REQUESTED') {
      throw new Error(`Contract is not available to take (current status: ${contract.status}).`);
    }

    const result = await this.contractCollection.updateOne(
      { _id: objectId, status: 'REQUESTED' },
      {
        $set: {
          status: 'TAKEN',
          supplierId: userId,
          supplierName: profile.companyName,
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount === 0) {
      throw new Error('Failed to take contract. It may have been claimed by another supplier.');
    }

    return { success: true, message: 'Contract taken successfully. Pending manager approval.' };
  }
}
