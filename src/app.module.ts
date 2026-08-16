import 'reflect-metadata';
import { McpApp, Module, ConfigModule, OAuthModule } from '@nitrostack/core';
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
        
        OAuthModule.forRoot({
            required: process.env.OAUTH_REQUIRED === 'true',
            resourceUri: process.env.RESOURCE_URI || 'https://mcplocal',
            authorizationServers: [
                process.env.AUTH_SERVER_URL || 'https://dev-grwqkyb8qkadp6ix.us.auth0.com',
            ],
            scopesSupported: [
                'read',
                'write',
                'admin',
            ],
            audience: process.env.AUDIENCE || process.env.TOKEN_AUDIENCE || 'https://warehouse-api',
            issuer: process.env.TOKEN_ISSUER || (process.env.AUTH_SERVER_URL ? `${process.env.AUTH_SERVER_URL}/` : undefined),
            jwksUri: process.env.JWKS_URI || (process.env.AUTH_SERVER_URL ? `${process.env.AUTH_SERVER_URL}/.well-known/jwks.json` : undefined),
        }),

        DatabaseModule,
        SharedModule,
        SupplierModule,
        InventoryModule,
        PurchasingModule,
        FormModule,
    ],
})
export class AppModule { }
