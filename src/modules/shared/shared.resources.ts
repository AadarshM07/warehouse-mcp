import { ResourceDecorator as Resource, ExecutionContext } from '@nitrostack/core';

export class SharedResources {
  @Resource({
    uri: 'app://shared/supplier-catalog',
    name: 'Supplier Catalog',
    description: 'Catalog of approved suppliers for the warehouse.',
    mimeType: 'application/json',
  })
  async getSupplierCatalog(ctx: ExecutionContext) {
    return [
      { id: 'SUP-001', name: 'Global Logistics Inc.', type: 'Logistics', status: 'Active' },
      { id: 'SUP-002', name: 'Acme Packaging', type: 'Packaging', status: 'Active' }
    ];
  }

  @Resource({
    uri: 'app://shared/uom-conversion',
    name: 'UOM Conversion Table',
    description: 'Unit of measure conversion table.',
    mimeType: 'application/json',
  })
  async getUOMConversionTable(ctx: ExecutionContext) {
    return {
      'BOX-TO-EA': { from: 'BOX', to: 'EA', multiplier: 12 },
      'PALLET-TO-BOX': { from: 'PALLET', to: 'BOX', multiplier: 24 }
    };
  }

  @Resource({
    uri: 'app://shared/location-directory',
    name: 'Location Directory',
    description: 'List of valid warehouse locations.',
    mimeType: 'application/json',
  })
  async getLocationDirectory(ctx: ExecutionContext) {
    return [
      { id: 'WH-MAIN', name: 'Main Distribution Center' },
      { id: 'WH-EAST', name: 'East Coast Hub' },
      { id: 'WH-WEST', name: 'West Coast Hub' }
    ];
  }

  @Resource({
    uri: 'app://shared/tolerance-policy',
    name: 'Tolerance Policy',
    description: 'Receiving over-receipt tolerance policy.',
    mimeType: 'application/json',
  })
  async getTolerancePolicy(ctx: ExecutionContext) {
    return {
      globalOverReceiptTolerancePercentage: 5,
      requiresManagerApprovalIfExceeded: true
    };
  }

  @Resource({
    uri: 'app://shared/cycle-count-schedule',
    name: 'Cycle Count Schedule',
    description: 'The standard schedule for cycle counting.',
    mimeType: 'application/json',
  })
  async getCycleCountSchedule(ctx: ExecutionContext) {
    return {
      frequency: 'Monthly',
      nextScheduled: '2026-09-01T00:00:00Z',
      assignedTo: 'Warehouse Operations Team'
    };
  }

  @Resource({
    uri: 'app://shared/capabilities/{role}',
    name: 'User Specific Capabilities',
    description: 'Lists the allowed and denied tools/capabilities for the given user role.',
    mimeType: 'application/json',
  })
  async getUserCapabilities(uri: string, ctx: ExecutionContext) {
    const match = uri.match(/app:\/\/shared\/capabilities\/(.+)/);
    const role = match ? match[1] : 'unknown';

    const capabilitiesMap: Record<string, { allowed: string[]; denied: string[] }> = {
      supplier: {
        allowed: [
          'create_supplier_profile',
          'submit_proposal',
          'list_warehouses',
          'list_needed_stocks',
          'start_form_session',
          'get_next_question',
          'get_previous_question',
          'save_answer',
          'submit_form',
          'get_current_user'
        ],
        denied: [
          'register_sku',
          'get_stock_level',
          'transfer_stock',
          'get_all_skus',
          'create_warehouse',
          'list_pending_proposals',
          'approve_proposal',
          'reject_proposal',
          'add_needed_stock'
        ],
      },
      manager: {
        allowed: [
          'register_sku',
          'get_stock_level',
          'transfer_stock',
          'get_all_skus',
          'create_warehouse',
          'list_warehouses',
          'list_pending_proposals',
          'approve_proposal',
          'reject_proposal',
          'add_needed_stock',
          'list_needed_stocks',
          'start_form_session',
          'get_next_question',
          'get_previous_question',
          'save_answer',
          'submit_form',
          'get_current_user'
        ],
        denied: [
          'create_supplier_profile',
          'submit_proposal'
        ],
      },
      admin: {
        allowed: [
          'register_sku',
          'get_stock_level',
          'transfer_stock',
          'get_all_skus',
          'create_warehouse',
          'list_warehouses',
          'list_pending_proposals',
          'approve_proposal',
          'reject_proposal',
          'add_needed_stock',
          'list_needed_stocks',
          'create_supplier_profile',
          'submit_proposal',
          'start_form_session',
          'get_next_question',
          'get_previous_question',
          'save_answer',
          'submit_form',
          'get_current_user'
        ],
        denied: [],
      },
    };

    const caps = capabilitiesMap[role] || { allowed: [], denied: [] };

    return {
      role,
      description: `Capabilities and constraints for user role: ${role}`,
      ...caps
    };
  }
}

