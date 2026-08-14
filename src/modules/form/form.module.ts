import { Module } from '@nitrostack/core';
import { FormService } from './form.service.js';
import { FormTools } from './form.tools.js';
import { DatabaseModule } from '../database/database.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { SupplierModule } from '../supplier/supplier.module.js';
import { PurchasingModule } from '../purchasing/purchasing.module.js';

@Module({
  name: 'form',
  imports: [
    DatabaseModule,
    InventoryModule,
    SupplierModule,
    PurchasingModule,
  ],
  providers: [FormService],
  controllers: [FormTools],
  exports: [FormService],
})
export class FormModule {}
