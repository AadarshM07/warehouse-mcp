import { ControllerDecorator as Controller, ToolDecorator as Tool, Injectable, z } from '@nitrostack/core';
import { ReportingService } from './reporting.service.js';

@Controller('reporting')
@Injectable({ deps: [ReportingService] })
export class ReportingTools {
  constructor(private readonly reportingService: ReportingService) {}

  @Tool({
    name: 'get_inventory_valuation',
    description: 'Calculates the total monetary value of current on-hand inventory.',
    inputSchema: z.object({}),
  })
  async getInventoryValuation() {
    return this.reportingService.getInventoryValuation();
  }

  @Tool({
    name: 'generate_shrinkage_report',
    description: 'Generates a report of inventory shrinkage (negative cycle count variances) over a period.',
    inputSchema: z.object({
      startDate: z.string().describe('ISO date string for start of period'),
      endDate: z.string().describe('ISO date string for end of period'),
    }),
  })
  async generateShrinkageReport(input: { startDate: string; endDate: string }) {
    return this.reportingService.generateShrinkageReport(input.startDate, input.endDate);
  }
}
