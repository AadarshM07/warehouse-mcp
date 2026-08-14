import { ControllerDecorator as Controller, ToolDecorator as Tool, Injectable, z, UseGuards } from '@nitrostack/core';
import { OAuthGuard } from '../../guards/oauth.guard.js';
import { WorkerGuard, ManagerGuard } from '../../guards/role.guard.js';
import { InventoryService } from './inventory.service.js';

@Controller('inventory')
@Injectable({ deps: [InventoryService] })
export class InventoryTools {
  constructor(private readonly inventoryService: InventoryService) {}

  @UseGuards(OAuthGuard)
  @Tool({
    name: 'register_sku',
    description: 'Registers a new SKU in the catalog.',
    inputSchema: z.object({
      sku: z.string().describe('The unique SKU code'),
      description: z.string().describe('SKU description'),
      reorderPoint: z.number().int().min(0).describe('Stock level that triggers a reorder'),
      reorderQuantity: z.number().int().min(1).describe('Amount to order when reorder point is reached'),
      preferredSupplierId: z.string().describe('ID of the preferred supplier for reordering'),
      locations: z.array(z.string()).describe('Warehouse IDs where this SKU will be stocked')
    }),
  })
  async registerSku(input: any) {
    return this.inventoryService.registerSku(input);
  }

  @UseGuards(OAuthGuard)
  @Tool({
    name: 'get_stock_level',
    description: 'Gets the current on-hand and available stock level for an SKU.',
    inputSchema: z.object({
      sku: z.string(),
      warehouseId: z.string().optional().describe('Optional warehouse ID to filter by'),
    }),
  })
  async getStockLevel(input: { sku: string; warehouseId?: string }) {
    return this.inventoryService.getStockLevel(input.sku, input.warehouseId);
  }

  @UseGuards(OAuthGuard)
  @Tool({
    name: 'list_low_stock_skus',
    description: 'Lists all SKUs whose available stock is at or below their reorder point.',
    inputSchema: z.object({}),
  })
  async listLowStockSkus() {
    return this.inventoryService.listLowStockSkus();
  }

  @UseGuards(OAuthGuard, WorkerGuard)
  @Tool({
    name: 'adjust_stock',
    description: 'Adjusts the on-hand stock for an SKU in a specific warehouse (e.g. for damage or found items).',
    inputSchema: z.object({
      sku: z.string(),
      warehouseId: z.string(),
      quantity: z.number().int().describe('Amount to adjust by (positive or negative)'),
      reason: z.string().describe('Reason for the adjustment')
    }),
  })
  async adjustStock(input: { sku: string; warehouseId: string; quantity: number; reason: string }) {
    return this.inventoryService.adjustStock(input.sku, input.warehouseId, input.quantity, input.reason);
  }

  @UseGuards(OAuthGuard, WorkerGuard)
  @Tool({
    name: 'transfer_stock',
    description: 'Transfers stock atomically between two warehouses.',
    inputSchema: z.object({
      sku: z.string(),
      fromWarehouseId: z.string(),
      toWarehouseId: z.string(),
      quantity: z.number().int().positive().describe('Amount to transfer')
    }),
  })
  async transferStock(input: { sku: string; fromWarehouseId: string; toWarehouseId: string; quantity: number }) {
    return this.inventoryService.transferStock(input.sku, input.fromWarehouseId, input.toWarehouseId, input.quantity);
  }

  @UseGuards(OAuthGuard, WorkerGuard)
  @Tool({
    name: 'start_cycle_count',
    description: 'Initializes a physical cycle count for an SKU at a specific warehouse.',
    inputSchema: z.object({
      sku: z.string(),
      warehouseId: z.string(),
    }),
  })
  async startCycleCount(input: { sku: string; warehouseId: string }) {
    const result = await this.inventoryService.startCycleCount(input.sku, input.warehouseId);
    return { success: true, cycleCountId: result._id?.toString(), expected: result.expectedQuantity };
  }

  @UseGuards(OAuthGuard, WorkerGuard)
  @Tool({
    name: 'record_cycle_count',
    description: 'Records the counted quantity and auto-adjusts stock based on variance.',
    inputSchema: z.object({
      countId: z.string().describe('MongoDB Object ID of the Cycle Count'),
      actualQuantity: z.number().int().min(0),
    }),
  })
  async recordCycleCount(input: { countId: string; actualQuantity: number }) {
    return this.inventoryService.recordCycleCount(input.countId, input.actualQuantity);
  }
}
