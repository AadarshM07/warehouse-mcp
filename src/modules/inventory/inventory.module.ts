import { Module } from '@nitrostack/core';
import { InventoryService } from './inventory.service.js';
import { InventoryTools } from './inventory.tools.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  name: 'inventory',
  imports: [DatabaseModule],
  providers: [InventoryService],
  controllers: [InventoryTools],
  exports: [InventoryService],
})
export class InventoryModule {}
