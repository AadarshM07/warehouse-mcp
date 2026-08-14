import { 
  Injectable, 
  OnModuleInit, 
  OnApplicationShutdown 
} from '@nitrostack/core';
import { MongoClient, Db } from 'mongodb';

@Injectable({ deps: [] })
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  private client!: MongoClient;
  private db!: Db;
  
  private readonly MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
  private readonly DB_NAME = process.env.DB_NAME || 'warehouse_management';

  async onModuleInit() {
    this.client = new MongoClient(this.MONGO_URL);
    await this.client.connect();
    this.db = this.client.db(this.DB_NAME);
    console.error(`✅ Connected to MongoDB: ${this.DB_NAME}`);
  }

  async onApplicationShutdown() {
    if (this.client) {
      await this.client.close();
      console.error('✅ Disconnected from MongoDB');
    }
  }

  getDb(): Db {
    return this.db;
  }

  getClient(): MongoClient {
    return this.client;
  }
}
