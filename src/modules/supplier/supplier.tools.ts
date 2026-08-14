import { ControllerDecorator as Controller, ToolDecorator as Tool, Injectable, z, UseGuards, ExecutionContext } from '@nitrostack/core';
import { OAuthGuard } from '../../guards/oauth.guard.js';
import { SupplierGuard } from '../../guards/role.guard.js';
import { SupplierService } from './supplier.service.js';

@Controller('supplier')
@Injectable({ deps: [SupplierService] })
export class SupplierTools {
  constructor(private readonly supplierService: SupplierService) {}

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
    description: 'Submits a bulk inventory proposal with cost details to the warehouse catalog (Supplier only).',
    inputSchema: z.object({
      sku: z.string().describe('SKU code of the proposed item'),
      description: z.string().describe('Basic details and description about the item'),
      bulkQuantity: z.number().int().positive().describe('Quantity available in bulk load'),
      unitCost: z.number().positive().describe('Cost of each unit of that item'),
    }),
  })
  async submitProposal(
    input: { sku: string; description: string; bulkQuantity: number; unitCost: number },
    context: ExecutionContext
  ) {
    const userId = (context as any).auth?.subject;
    if (!userId) throw new Error('Unauthenticated user.');
    return this.supplierService.submitProposal(userId, input.sku, input.description, input.bulkQuantity, input.unitCost);
  }

  @UseGuards(OAuthGuard, SupplierGuard)
  @Tool({
    name: 'list_available_contracts',
    description: 'Lists all open warehouse stock request contracts available for bidding (Supplier only).',
    inputSchema: z.object({}),
  })
  async listAvailableContracts() {
    return this.supplierService.listAvailableContracts();
  }

  @UseGuards(OAuthGuard, SupplierGuard)
  @Tool({
    name: 'take_contract',
    description: 'Accepts/claims an open warehouse stock request contract (Supplier only).',
    inputSchema: z.object({
      contractId: z.string().describe('The MongoDB ObjectID of the contract to take'),
    }),
  })
  async takeContract(input: { contractId: string }, context: ExecutionContext) {
    const userId = (context as any).auth?.subject;
    if (!userId) throw new Error('Unauthenticated user.');
    return this.supplierService.takeContract(input.contractId, userId);
  }
}
