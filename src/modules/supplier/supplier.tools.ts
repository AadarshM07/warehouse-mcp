import { ControllerDecorator as Controller, ToolDecorator as Tool, Injectable, z } from '@nitrostack/core';
import { SupplierService } from './supplier.service.js';

@Controller('supplier')
@Injectable({ deps: [SupplierService] })
export class SupplierTools {
  constructor(private readonly supplierService: SupplierService) {}

  @Tool({
    name: 'register_supplier',
    description: 'Registers a new supplier in the system.',
    inputSchema: z.object({
      name: z.string().describe('Supplier company name'),
      contactEmail: z.string().email().describe('Primary contact email for the supplier'),
    }),
  })
  async registerSupplier(input: { name: string; contactEmail: string }) {
    const result = await this.supplierService.registerSupplier(input.name, input.contactEmail);
    return { success: true, supplierId: result._id?.toString() };
  }

  @Tool({
    name: 'list_suppliers',
    description: 'Lists suppliers, optionally filtered by status.',
    inputSchema: z.object({
      status: z.enum(['ACTIVE', 'INACTIVE']).optional().describe('Filter by status'),
    }),
  })
  async listSuppliers(input: { status?: 'ACTIVE' | 'INACTIVE' }) {
    const suppliers = await this.supplierService.listSuppliers(input.status);
    return suppliers;
  }

  @Tool({
    name: 'deactivate_supplier',
    description: 'Deactivates a supplier if they have no open purchase orders.',
    inputSchema: z.object({
      id: z.string().describe('The MongoDB ObjectID of the supplier'),
    }),
  })
  async deactivateSupplier(input: { id: string }) {
    return this.supplierService.deactivateSupplier(input.id);
  }
}
