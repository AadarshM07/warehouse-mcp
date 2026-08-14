import { ControllerDecorator as Controller, ToolDecorator as Tool, Injectable, z, UseGuards, ExecutionContext } from '@nitrostack/core';
import { OAuthGuard } from '../../guards/oauth.guard.js';
import { ManagerGuard } from '../../guards/role.guard.js';
import { PurchasingService } from './purchasing.service.js';

@Controller('purchasing')
@Injectable({ deps: [PurchasingService] })
export class PurchasingTools {
  constructor(private readonly purchasingService: PurchasingService) {}

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'request_stock',
    description: 'Creates a stock request contract open to all suppliers (Manager only).',
    inputSchema: z.object({
      sku: z.string().describe('The SKU code requested'),
      quantity: z.number().int().positive().describe('The quantity requested'),
      warehouseId: z.string().describe('The warehouse ID where stock should be delivered'),
    }),
  })
  async requestStock(input: { sku: string; quantity: number; warehouseId: string }, context: ExecutionContext) {
    const managerId = (context as any).auth?.subject || 'unknown';
    return this.purchasingService.requestStock(input.sku, input.quantity, input.warehouseId, managerId);
  }

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'list_pending_contracts',
    description: 'Lists all contracts currently claimed/taken by suppliers waiting for manager approval (Manager only).',
    inputSchema: z.object({}),
  })
  async listPendingContracts() {
    return this.purchasingService.listPendingContracts();
  }

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'approve_contract',
    description: 'Approves a supplier contract bid, activating the contract (Manager only).',
    inputSchema: z.object({
      contractId: z.string().describe('The MongoDB ObjectID of the contract'),
    }),
  })
  async approveContract(input: { contractId: string }, context: ExecutionContext) {
    const managerId = (context as any).auth?.subject || 'unknown';
    return this.purchasingService.approveContract(input.contractId, managerId);
  }

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'reject_contract',
    description: 'Rejects a supplier contract bid and returns it to REQUESTED status for other suppliers to claim (Manager only).',
    inputSchema: z.object({
      contractId: z.string().describe('The MongoDB ObjectID of the contract'),
    }),
  })
  async rejectContract(input: { contractId: string }) {
    return this.purchasingService.rejectContract(input.contractId);
  }

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'cancel_contract',
    description: 'Cancels a stock request contract (Manager only).',
    inputSchema: z.object({
      contractId: z.string().describe('The MongoDB ObjectID of the contract'),
    }),
  })
  async cancelContract(input: { contractId: string }) {
    return this.purchasingService.cancelContract(input.contractId);
  }

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'receive_contract',
    description: 'Receives and logs stock delivery for an APPROVED contract, updating SKU inventory levels (Manager only).',
    inputSchema: z.object({
      contractId: z.string().describe('The MongoDB ObjectID of the contract'),
      warehouseId: z.string().describe('The warehouse ID where stock is received'),
    }),
  })
  async receiveContract(input: { contractId: string; warehouseId: string }) {
    return this.purchasingService.receiveContract(input.contractId, input.warehouseId);
  }

  @UseGuards(OAuthGuard, ManagerGuard)
  @Tool({
    name: 'approve_proposal',
    description: 'Approves a supplier proposal. Automatically registers or updates the SKU in the catalog (Manager only).',
    inputSchema: z.object({
      proposalId: z.string().describe('The MongoDB ObjectID of the proposal'),
    }),
  })
  async approveProposal(input: { proposalId: string }) {
    return this.purchasingService.approveProposal(input.proposalId);
  }
}
