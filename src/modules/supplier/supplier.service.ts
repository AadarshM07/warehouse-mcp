import { Injectable } from '@nitrostack/core';
import { DatabaseService } from '../database/database.service.js';
import { ObjectId } from 'mongodb';

export interface Supplier {
  _id?: ObjectId;
  name: string;
  contactEmail: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
}

@Injectable({ deps: [DatabaseService] })
export class SupplierService {
  constructor(private readonly db: DatabaseService) {}

  private get collection() {
    return this.db.getDb().collection<Supplier>('suppliers');
  }
  
  private get poCollection() {
    return this.db.getDb().collection('purchase_orders');
  }

  async registerSupplier(name: string, contactEmail: string) {
    const supplier: Supplier = {
      name,
      contactEmail,
      status: 'ACTIVE',
      createdAt: new Date(),
    };
    const result = await this.collection.insertOne(supplier);
    return { ...supplier, _id: result.insertedId };
  }

  async listSuppliers(status?: 'ACTIVE' | 'INACTIVE') {
    const query = status ? { status } : {};
    return this.collection.find(query).toArray();
  }

  async deactivateSupplier(id: string) {
    const objectId = new ObjectId(id);
    
    // Check for open POs
    const openPOs = await this.poCollection.countDocuments({
      supplierId: id,
      status: { $in: ['DRAFT', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] }
    });

    if (openPOs > 0) {
      throw new Error(`Cannot deactivate supplier. There are ${openPOs} open purchase orders.`);
    }

    const result = await this.collection.updateOne(
      { _id: objectId },
      { $set: { status: 'INACTIVE' } }
    );

    if (result.matchedCount === 0) {
      throw new Error('Supplier not found.');
    }

    return { success: true, message: 'Supplier deactivated successfully.' };
  }
}
