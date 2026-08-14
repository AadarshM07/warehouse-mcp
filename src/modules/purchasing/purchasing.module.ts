import { Module } from '@nitrostack/core';
import { PurchasingService } from './purchasing.service.js';
import { PurchasingTools } from './purchasing.tools.js';
import { DatabaseModule } from '../database/database.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';

@Module({
  name: 'purchasing',
  imports: [DatabaseModule, InventoryModule],
  providers: [PurchasingService],
  controllers: [PurchasingTools],
  exports: [PurchasingService],
})
export class PurchasingModule {}
