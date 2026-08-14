import { Injectable } from '@nitrostack/core';
import { DatabaseService } from '../database/database.service.js';
import { Sku, Movement } from '../inventory/inventory.service.js';

@Injectable({ deps: [DatabaseService] })
export class ReportingService {
  constructor(private readonly db: DatabaseService) {}

  private get skus() { return this.db.getDb().collection<Sku & { unitCost?: number }>('skus'); }
  private get movements() { return this.db.getDb().collection<Movement>('movements'); }

  async getInventoryValuation() {
    const allSkus = await this.skus.find({}).toArray();
    let totalValue = 0;
    
    const valuationBySku = allSkus.map(sku => {
      const cost = sku.unitCost || 10; // Defaulting to 10 if unitCost is not set
      const value = sku.onHand * cost;
      totalValue += value;
      return { sku: sku.sku, onHand: sku.onHand, unitCost: cost, totalValue: value };
    });

    return { totalValuation: totalValue, items: valuationBySku };
  }

  async generateShrinkageReport(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const cycleCountMovements = await this.movements.find({
      type: 'CYCLE_COUNT',
      timestamp: { $gte: start, $lte: end }
    }).toArray();

    let totalShrinkageUnits = 0;
    let totalGainUnits = 0;

    cycleCountMovements.forEach(m => {
      if (m.quantity < 0) totalShrinkageUnits += Math.abs(m.quantity);
      if (m.quantity > 0) totalGainUnits += m.quantity;
    });

    return {
      period: { start, end },
      totalShrinkageUnits,
      totalGainUnits,
      netVariance: totalGainUnits - totalShrinkageUnits,
      movements: cycleCountMovements
    };
  }
}
