import { ControllerDecorator as Controller, ToolDecorator as Tool, Injectable, z, UseGuards, ExecutionContext } from '@nitrostack/core';
import { OAuthGuard } from '../../guards/oauth.guard.js';
import { WorkerGuard, ManagerGuard } from '../../guards/role.guard.js';
import { PurchasingService } from './purchasing.service.js';

@Controller('purchasing')
@Injectable({ deps: [PurchasingService] })
export class PurchasingTools {
  constructor(private readonly purchasingService: PurchasingService) {}

  @UseGuards(OAuthGuard, WorkerGuard)
  @Tool({
    name: 'generate_draft_po',
    description: 'Generates a draft PO for a specific SKU. Fails if an open PO already exists.',
    inputSchema: z.object({
      sku: z.string(),
    }),
  })
  async generateDraftPO(input: { sku: string }, context: ExecutionContext) {
    const createdBy = (context as any).auth?.subject || 'unknown';
    return this.purchasingService.generateDraftPO(input.sku, createdBy);
  }

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'approve_po',
    description: 'Approves a DRAFT PO. Cannot be approved by the creator.',
    inputSchema: z.object({
      poId: z.string().describe('MongoDB Object ID of the PO'),
    }),
  })
  async approvePO(input: { poId: string }, context: ExecutionContext) {
    const approvedBy = (context as any).auth?.subject || 'unknown';
    return this.purchasingService.approvePO(input.poId, approvedBy);
  }

  @UseGuards(OAuthGuard)
  @Tool({
    name: 'send_po',
    description: 'Marks an APPROVED PO as SENT.',
    inputSchema: z.object({
      poId: z.string().describe('MongoDB Object ID of the PO'),
    }),
  })
  async sendPO(input: { poId: string }) {
    return this.purchasingService.sendPO(input.poId);
  }

  @UseGuards(OAuthGuard)
  @Tool({
    name: 'cancel_po',
    description: 'Cancels a DRAFT or APPROVED PO.',
    inputSchema: z.object({
      poId: z.string().describe('MongoDB Object ID of the PO'),
    }),
  })
  async cancelPO(input: { poId: string }) {
    return this.purchasingService.cancelPO(input.poId);
  }

  @UseGuards(OAuthGuard, WorkerGuard)
  @Tool({
    name: 'receive_po',
    description: 'Receives items against a SENT PO and updates stock atomically.',
    inputSchema: z.object({
      poId: z.string().describe('MongoDB Object ID of the PO'),
      quantity: z.number().int().positive().describe('Amount received'),
      warehouseId: z.string().describe('Warehouse where stock is received'),
    }),
  })
  async receivePO(input: { poId: string; quantity: number; warehouseId: string }) {
    return this.purchasingService.receivePO(input.poId, input.quantity, input.warehouseId);
  }
}
