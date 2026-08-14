import { Module } from '@nitrostack/core';
import { SupplierService } from './supplier.service.js';
import { SupplierTools } from './supplier.tools.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  name: 'supplier',
  imports: [DatabaseModule],
  providers: [SupplierService],
  controllers: [SupplierTools],
  exports: [SupplierService],
})
export class SupplierModule {}
