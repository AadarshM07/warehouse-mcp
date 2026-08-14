import { ControllerDecorator as Controller, ToolDecorator as Tool, Injectable, z, UseGuards } from '@nitrostack/core';
import { OAuthGuard } from '../../guards/oauth.guard.js';
import { ManagerGuard } from '../../guards/role.guard.js';
import { InventoryService } from './inventory.service.js';

@Controller('inventory')
@Injectable({ deps: [InventoryService] })
export class InventoryTools {
  constructor(private readonly inventoryService: InventoryService) {}

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'register_sku',
    description: 'Registers a new SKU in the catalog (Manager only).',
    inputSchema: z.object({
      sku: z.string().describe('The unique SKU code'),
      description: z.string().describe('SKU description'),
      reorderPoint: z.number().int().min(0).describe('Stock level that triggers a reorder'),
      reorderQuantity: z.number().int().min(1).describe('Amount to order when reorder point is reached'),
      preferredSupplierId: z.string().describe('ID of the preferred supplier for reordering'),
      locations: z.array(z.string()).describe('Warehouse IDs where this SKU will be stocked'),
      unitCost: z.number().min(0).optional().describe('Cost per unit of this SKU')
    }),
  })
  async registerSku(input: any) {
    return this.inventoryService.registerSku(input);
  }

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'get_stock_level',
    description: 'Gets the current on-hand and available stock level for an SKU (Manager only).',
    inputSchema: z.object({
      sku: z.string().describe('The SKU code'),
      warehouseId: z.string().optional().describe('Optional warehouse ID to filter by'),
    }),
  })
  async getStockLevel(input: { sku: string; warehouseId?: string }) {
    return this.inventoryService.getStockLevel(input.sku, input.warehouseId);
  }

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'adjust_stock',
    description: 'Adjusts the on-hand stock for an SKU in a specific warehouse (Manager only).',
    inputSchema: z.object({
      sku: z.string().describe('The SKU code'),
      warehouseId: z.string().describe('Warehouse ID'),
      quantity: z.number().int().describe('Amount to adjust by (positive or negative)'),
      reason: z.string().describe('Reason for the adjustment')
    }),
  })
  async adjustStock(input: { sku: string; warehouseId: string; quantity: number; reason: string }) {
    return this.inventoryService.adjustStock(input.sku, input.warehouseId, input.quantity, input.reason);
  }

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'transfer_stock',
    description: 'Transfers stock atomically between two warehouses (Manager only).',
    inputSchema: z.object({
      sku: z.string().describe('The SKU code'),
      fromWarehouseId: z.string().describe('Source warehouse ID'),
      toWarehouseId: z.string().describe('Target warehouse ID'),
      quantity: z.number().int().positive().describe('Amount to transfer')
    }),
  })
  async transferStock(input: { sku: string; fromWarehouseId: string; toWarehouseId: string; quantity: number }) {
    return this.inventoryService.transferStock(input.sku, input.fromWarehouseId, input.toWarehouseId, input.quantity);
  }
}
