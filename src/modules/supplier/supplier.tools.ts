import { ControllerDecorator as Controller, ToolDecorator as Tool, Widget, Injectable, z, UseGuards, ExecutionContext } from '@nitrostack/core';
import { OAuthGuard } from '../../guards/oauth.guard.js';
import { SupplierGuard, ManagerGuard } from '../../guards/role.guard.js';
import { SupplierService } from './supplier.service.js';

@Controller('supplier')
@Injectable({ deps: [SupplierService] })
export class SupplierTools {
  constructor(private readonly supplierService: SupplierService) {}

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'list_verified_suppliers',
    description: 'Lists all verified/active suppliers in the system (Manager only).',
    inputSchema: z.object({}),
  })
  @Widget('list-widget')
  async listVerifiedSuppliers() {
    const suppliers = await this.supplierService.listVerifiedSuppliers();
    return {
      title: 'Verified Suppliers',
      subtitle: 'Active suppliers authorized to fulfill inventory requests',
      items: suppliers.map(s => ({
        id: s.userId || String(s._id),
        title: s.companyName,
        subtitle: `Contact: ${s.contactEmail}`,
        badge: {
          text: s.status,
          type: 'success'
        },
        details: [
          { label: 'Supplier ID', value: s.userId || String(s._id) },
          { label: 'Registered', value: s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'N/A' }
        ]
      }))
    };
  }

  @UseGuards(OAuthGuard, SupplierGuard)
  @Tool({
    name: 'create_supplier_profile',
    description: 'Registers a profile for the authenticated supplier (Supplier only).',
    inputSchema: z.object({
      companyName: z.string().describe('The supplier company name'),
      contactEmail: z.string().email().describe('The primary contact email for the supplier'),
    }),
  })
  async createSupplierProfile(input: { companyName: string; contactEmail: string }, context: ExecutionContext) {
    const userId = (context as any).auth?.subject;
    if (!userId) throw new Error('Unauthenticated user.');
    return this.supplierService.createProfile(userId, input.companyName, input.contactEmail);
  }

  @UseGuards(OAuthGuard, SupplierGuard)
  @Tool({
    name: 'submit_proposal',
    description: 'Submits a proposal for a needed stock requirement (Supplier only).',
    inputSchema: z.object({
      neededStockId: z.string().describe('The MongoDB ObjectID of the needed stock requirement'),
      warehouseId: z.string().describe('The warehouse ID where you will supply the stock'),
      bulkQuantity: z.number().int().positive().describe('The quantity you can supply'),
      unitCost: z.number().positive().describe('The unit cost of the proposed stock'),
    }),
  })
  async submitProposal(
    input: { neededStockId: string; warehouseId: string; bulkQuantity: number; unitCost: number },
    context: ExecutionContext
  ) {
    const userId = (context as any).auth?.subject;
    if (!userId) throw new Error('Unauthenticated user.');
    return this.supplierService.submitProposal(userId, input.neededStockId, input.warehouseId, input.bulkQuantity, input.unitCost);
  }

}
