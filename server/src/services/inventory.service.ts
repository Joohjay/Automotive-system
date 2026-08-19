import { Prisma, type InventoryTransactionType } from '@prisma/client';

import { ApiError } from '../middleware/error.js';

export interface StockChangeInput {
  branchId: string;
  productId: string;
  locationId: string;
  type: InventoryTransactionType;
  /** Signed: positive = stock in, negative = stock out. */
  quantity: number;
  unitCost?: Prisma.Decimal;
  referenceType: string;
  referenceId: string;
  createdById?: string | null;
  note?: string;
}

export interface StockChangeResult {
  inventoryId: string;
  quantityOnHand: number;
}

/**
 * Applies a single inventory movement inside a Prisma transaction.
 * Updates the Inventory snapshot and appends to the InventoryTransaction ledger.
 * Refuses to take stock below zero.
 */
export async function applyStockChange(
  tx: Prisma.TransactionClient,
  input: StockChangeInput,
): Promise<StockChangeResult> {
  if (input.quantity === 0) {
    throw ApiError.badRequest('Stock quantity cannot be zero');
  }

  const key = {
    branchId: input.branchId,
    productId: input.productId,
    locationId: input.locationId,
  };

  let inventory = await tx.inventory.findUnique({
    where: { branchId_productId_locationId: key },
  });

  if (!inventory) {
    if (input.quantity < 0) {
      throw ApiError.badRequest('No stock on hand for this product/location');
    }
    inventory = await tx.inventory.create({
      data: { ...key, quantityOnHand: 0 },
    });
  }

  const quantityOnHand = inventory.quantityOnHand + input.quantity;
  if (quantityOnHand < 0) {
    throw ApiError.badRequest(
      `Insufficient stock: available ${inventory.quantityOnHand}, requested ${-input.quantity}`,
    );
  }

  // Weighted-average cost maintenance: only a stock-in movement that carries a
  // cost basis (purchase receiving) moves the average. Sales, returns,
  // adjustments and voids never change the valuation basis.
  let avgCost = inventory.avgCost;
  if (input.quantity > 0 && input.unitCost && input.unitCost.greaterThan(0)) {
    const totalCost = inventory.avgCost
      .mul(inventory.quantityOnHand)
      .plus(input.unitCost.mul(input.quantity));
    avgCost = totalCost
      .div(quantityOnHand)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }

  await tx.inventory.update({
    where: { id: inventory.id },
    data: { quantityOnHand, avgCost },
  });

  await tx.inventoryTransaction.create({
    data: {
      branchId: input.branchId,
      productId: input.productId,
      locationId: input.locationId,
      type: input.type,
      quantity: input.quantity,
      unitCost: input.unitCost,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      createdById: input.createdById,
      note: input.note,
    },
  });

  return { inventoryId: inventory.id, quantityOnHand };
}

export function toDecimal(value: string | number | Prisma.Decimal): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value);
}