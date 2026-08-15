import { ControllerDecorator as Controller, ToolDecorator as Tool, Widget, Injectable, z, UseGuards } from '@nitrostack/core';
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
      locations: z.array(z.string()).describe('Warehouse IDs where this SKU will be stocked'),
      unitCost: z.number().min(0).optional().describe('Cost per unit of this SKU')
    }),
  })
  async registerSku(input: any) {
    return this.inventoryService.registerSku(input);
  }

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'get_all_skus',
    description: 'Retrieves all available SKUs in the catalog (Manager only).',
    inputSchema: z.object({}),
  })
  @Widget('list-widget')
  async getAllSkus() {
    const skus = await this.inventoryService.getAllSkus();
    return {
      title: 'SKU Catalog',
      subtitle: 'All registered catalog products',
      items: skus.map(s => ({
        id: s.sku,
        title: s.description,
        subtitle: `Preferred Supplier: ${s.preferredSupplierId || 'None'}`,
        badge: {
          text: s.onHand <= s.reorderPoint ? 'Low Stock' : 'In Stock',
          type: s.onHand <= s.reorderPoint ? 'warning' : 'success'
        },
        details: [
          { label: 'On Hand', value: s.onHand },
          { label: 'Reserved', value: s.reserved },
          { label: 'Reorder Point', value: s.reorderPoint },
          { label: 'Reorder Qty', value: s.reorderQuantity },
          { label: 'Unit Cost', value: s.unitCost ? `$${s.unitCost}` : 'N/A' }
        ]
      }))
    };
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

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'create_warehouse',
    description: 'Creates a new warehouse profile (Manager only).',
    inputSchema: z.object({
      warehouseId: z.string().describe('The unique warehouse ID (e.g., WH-EAST)'),
      name: z.string().describe('The name of the warehouse'),
      location: z.string().describe('Physical location or address'),
    }),
  })
  async createWarehouse(input: { warehouseId: string; name: string; location: string }) {
    return this.inventoryService.createWarehouse(input.warehouseId, input.name, input.location);
  }

  @UseGuards(OAuthGuard)
  @Tool({
    name: 'list_warehouses',
    description: 'Lists all available warehouses in the system.',
    inputSchema: z.object({}),
  })
  @Widget('list-widget')
  async listWarehouses() {
    const warehouses = await this.inventoryService.listWarehouses();
    return {
      title: 'Warehouse Registry',
      subtitle: 'All active company warehouses',
      items: warehouses.map(w => ({
        id: w.warehouseId,
        title: w.name,
        subtitle: `Location: ${w.location}`,
        details: []
      }))
    };
  }
}
