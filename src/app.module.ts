import 'reflect-metadata';
import { McpApp, Module, ConfigModule } from '@nitrostack/core';
import { DatabaseModule } from './modules/database/database.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { PurchasingModule } from './modules/purchasing/purchasing.module.js';
import { SupplierModule } from './modules/supplier/supplier.module.js';
import { FormModule } from './modules/form/form.module.js';
import { SharedModule } from './modules/shared/shared.module.js';

/**
 * Root Application Module
 * 
 * Inventory & Warehouse Reorder MCP
 */
@McpApp({
    module: AppModule,
    server: {
        name: 'warehouse-management',
        version: '1.0.0'
    },
    logging: {
        level: 'info'
    }
})
@Module({
    name: 'warehouse',
    description: 'Inventory & Warehouse Reorder MCP',
    imports: [
        ConfigModule.forRoot(),
        DatabaseModule,
        SharedModule,
        SupplierModule,
        InventoryModule,
        PurchasingModule,
        FormModule,
    ],
})
export class AppModule { }
