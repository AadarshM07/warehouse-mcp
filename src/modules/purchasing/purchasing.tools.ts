import { ControllerDecorator as Controller, ToolDecorator as Tool, Widget, Injectable, z, UseGuards, ExecutionContext } from '@nitrostack/core';
import { OAuthGuard } from '../../guards/oauth.guard.js';
import { ManagerGuard, SupplierGuard } from '../../guards/role.guard.js';
import { PurchasingService } from './purchasing.service.js';

@Controller('purchasing')
@Injectable({ deps: [PurchasingService] })
export class PurchasingTools {
  constructor(private readonly purchasingService: PurchasingService) {}

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'list_pending_proposals',
    description: 'Lists all pending supplier proposals waiting for manager approval (Manager only).',
    inputSchema: z.object({}),
  })
  @Widget('list-widget')
  async listPendingProposals() {
    const proposals = await this.purchasingService.listPendingProposals();
    return {
      title: 'Pending Supplier Proposals',
      subtitle: 'Supplier bulk stock proposals waiting for approval',
      items: proposals.map(p => ({
        id: p._id?.toString(),
        title: p.sku,
        subtitle: `Supplier: ${p.supplierName || p.supplierId}`,
        badge: {
          text: p.status,
          type: 'warning'
        },
        details: [
          { label: 'Bulk Qty', value: p.bulkQuantity },
          { label: 'Unit Cost', value: `$${p.unitCost}` },
          { label: 'Warehouse Target', value: p.warehouseId || 'WH-MAIN' },
          { label: 'Description', value: p.description || 'N/A' },
          { label: 'Submitted At', value: new Date(p.createdAt).toLocaleDateString() }
        ]
      }))
    };
  }

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'approve_proposal',
    description: 'Approves a supplier proposal. Registers/updates the SKU in the catalog and receives the bulk quantity of stock in the proposal\'s target warehouse (Manager only).',
    inputSchema: z.object({
      proposalId: z.string().describe('The MongoDB ObjectID of the proposal to approve'),
    }),
  })
  async approveProposal(input: { proposalId: string }) {
    return this.purchasingService.approveProposal(input.proposalId);
  }

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'reject_proposal',
    description: 'Rejects a pending supplier proposal (Manager only).',
    inputSchema: z.object({
      proposalId: z.string().describe('The MongoDB ObjectID of the proposal to reject'),
    }),
  })
  async rejectProposal(input: { proposalId: string }) {
    return this.purchasingService.rejectProposal(input.proposalId);
  }

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'add_needed_stock',
    description: 'Adds a stock requirement that suppliers are expected to propose for (Manager only).',
    inputSchema: z.object({
      sku: z.string().describe('The SKU code needed'),
      quantityNeeded: z.number().int().positive().describe('The quantity needed'),
      unit: z.string().describe('The unit of measure (e.g. EA, BOX)'),
      warehouseId: z.string().describe('The warehouse ID where stock is needed'),
    }),
  })
  async addNeededStock(input: { sku: string; quantityNeeded: number; unit: string; warehouseId: string }) {
    return this.purchasingService.addNeededStock(input.sku, input.quantityNeeded, input.unit, input.warehouseId);
  }

  @UseGuards(OAuthGuard)
  @Tool({
    name: 'list_needed_stocks',
    description: 'Lists all stock requirements and their fulfillment status.',
    inputSchema: z.object({}),
  })
  @Widget('list-widget')
  async listNeededStocks() {
    const requirements = await this.purchasingService.listNeededStocks();
    return {
      title: 'Stock Requirements',
      subtitle: 'Items needed by the warehouse network',
      items: requirements.map(r => ({
        id: r._id?.toString(),
        title: r.sku,
        subtitle: `Warehouse: ${r.warehouseId}`,
        badge: {
          text: r.status,
          type: r.status === 'OPEN' ? 'info' : 'success'
        },
        details: [
          { label: 'Quantity Needed', value: `${r.quantityNeeded} ${r.unit}` },
          { label: 'Target Warehouse', value: r.warehouseId },
          { label: 'Status', value: r.status },
          { label: 'Created At', value: new Date(r.createdAt).toLocaleDateString() }
        ]
      }))
    };
  }

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'create_reorder_contract',
    description: 'Creates a pending reorder contract for a supplier (Manager only).',
    inputSchema: z.object({
      sku: z.string().describe('The SKU code'),
      reorderPoint: z.number().int().min(0).describe('Stock level that triggers reorder'),
      reorderQuantity: z.number().int().min(1).describe('Quantity to order when triggered'),
      supplierId: z.string().describe('The supplier user ID'),
    }),
  })
  async createReorderContract(input: { sku: string; reorderPoint: number; reorderQuantity: number; supplierId: string }) {
    return this.purchasingService.createReorderContract(input.sku, input.reorderPoint, input.reorderQuantity, input.supplierId);
  }

  @UseGuards(OAuthGuard, SupplierGuard)
  @Tool({
    name: 'list_supplier_contracts',
    description: 'Lists all reorder contracts for the logged-in supplier (Supplier only).',
    inputSchema: z.object({}),
  })
  @Widget('contracts-widget')
  async listSupplierContracts(input: any, context: ExecutionContext) {
    const userId = (context as any).auth?.subject;
    if (!userId) throw new Error('Unauthenticated.');
    const contracts = await this.purchasingService.listSupplierContracts(userId);
    return {
      title: 'Supplier Contracts Dashboard',
      subtitle: 'Review and approve reorder agreements for inventory items',
      items: contracts.map(c => ({
        id: c._id?.toString(),
        sku: c.sku,
        reorderPoint: c.reorderPoint,
        reorderQuantity: c.reorderQuantity,
        status: c.status,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }))
    };
  }

  @UseGuards(OAuthGuard, SupplierGuard)
  @Tool({
    name: 'approve_reorder_contract',
    description: 'Approves a pending reorder contract (Supplier only).',
    inputSchema: z.object({
      contractId: z.string().describe('The MongoDB ObjectID of the contract to approve'),
    }),
  })
  async approveReorderContract(input: { contractId: string }, context: ExecutionContext) {
    const userId = (context as any).auth?.subject;
    if (!userId) throw new Error('Unauthenticated.');
    return this.purchasingService.approveContract(input.contractId, userId);
  }

  @UseGuards(OAuthGuard, SupplierGuard)
  @Tool({
    name: 'reject_reorder_contract',
    description: 'Rejects a pending reorder contract (Supplier only).',
    inputSchema: z.object({
      contractId: z.string().describe('The MongoDB ObjectID of the contract to reject'),
    }),
  })
  async rejectReorderContract(input: { contractId: string }, context: ExecutionContext) {
    const userId = (context as any).auth?.subject;
    if (!userId) throw new Error('Unauthenticated.');
    return this.purchasingService.rejectContract(input.contractId, userId);
  }
}

