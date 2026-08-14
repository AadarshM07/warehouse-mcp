import { PromptDecorator as Prompt, ExecutionContext } from '@nitrostack/core';

export class SharedPrompts {
  @Prompt({
    name: 'reorder_justification',
    description: 'Generates a prompt template to justify a draft PO.',
    arguments: [
      { name: 'sku', description: 'The SKU number', required: true },
      { name: 'reason', description: 'Reason for the reorder', required: true },
    ],
  })
  async getReorderJustification(args: { sku: string; reason: string }, ctx: ExecutionContext) {
    return {
      messages: [
        {
          role: 'user',
          content: `Please generate a brief justification statement for the purchase order of SKU ${args.sku}. The primary reason provided is: ${args.reason}. Keep it professional and concise.`
        }
      ]
    };
  }

  @Prompt({
    name: 'po_cover_letter',
    description: 'Generates a cover letter for sending a PO to a supplier.',
    arguments: [
      { name: 'poNumber', description: 'The Purchase Order number', required: true },
      { name: 'supplierName', description: 'The name of the supplier', required: true },
    ],
  })
  async getPoCoverLetter(args: { poNumber: string; supplierName: string }, ctx: ExecutionContext) {
    return {
      messages: [
        {
          role: 'user',
          content: `Write a short, professional email cover letter to ${args.supplierName} attaching Purchase Order ${args.poNumber}. Thank them for their continued partnership.`
        }
      ]
    };
  }

}
