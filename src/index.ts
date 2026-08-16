/**
 * Warehouse Management MCP Server
 * 
 * Inventory & Warehouse Reorder MCP
 */

import 'reflect-metadata';
import 'dotenv/config';
import { McpApplicationFactory } from '@nitrostack/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
    // Create and start the MCP server
    const server = await McpApplicationFactory.create(AppModule);
    await server.start();

    // Retrieve Express app and prepend a middleware to bridge HTTP headers to MCP Execution Context
    const app = (server as any).getHttpTransport()?.getApp?.();
    if (app && app._router && app._router.stack) {
        const tokenBridgeMiddleware = (req: any, res: any, next: any) => {
            if (req.method === 'POST' && req.body && req.body.params) {
                const authHeader = req.headers.authorization || req.body.params._meta?.authorization;
                if (authHeader) {
                    if (!req.body.params.arguments) {
                        req.body.params.arguments = {};
                    }
                    if (!req.body.params.arguments._meta) {
                        req.body.params.arguments._meta = {};
                    }
                    req.body.params.arguments._meta.authorization = authHeader;
                }
            }
            next();
        };

        const stack = app._router.stack;
        const index = stack.findIndex((layer: any) => {
            return layer.route && layer.route.methods && layer.route.methods.post;
        });

        if (index !== -1) {
            app.use(tokenBridgeMiddleware);
            const myLayer = stack.pop();
            stack.splice(index, 0, myLayer);
            console.error('🌐 Attached Authorization header bridge middleware to Express app');
        } else {
            app.use(tokenBridgeMiddleware);
            const myLayer = stack.pop();
            stack.unshift(myLayer);
            console.error('🌐 Prepended Authorization header bridge middleware to Express app');
        }
    }
}

// Start the application
bootstrap().catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});
