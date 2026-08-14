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
}
