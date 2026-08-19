import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { z } from 'zod';

import prisma from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { recordAudit, scalarize } from '../services/audit.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paramId, parseBody, parseQuery } from '../utils/validate.js';
import {
  createProductSchema,
  productQuerySchema,
  updateProductSchema,
} from '../validators/product.validator.js';

function stockOf(product: { inventory: { quantityOnHand: number; location?: { code: string; name: string } | null }[] }) {
  const row = product.inventory[0];
  return {
    quantityOnHand: row?.quantityOnHand ?? 0,
    locationCode: row?.location?.code ?? null,
    locationName: row?.location?.name ?? null,
  };
}

const listInclude = {
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
} as const;

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const query = parseQuery(productQuerySchema, req.query);

  const where: Prisma.ProductWhereInput = {
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.brandId ? { brandId: query.brandId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { sku: { contains: query.search, mode: 'insensitive' } },
            { partNumber: { contains: query.search, mode: 'insensitive' } },
            { brand: { name: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        ...listInclude,
        inventory: {
          where: { branchId: req.user!.branchId },
          select: { quantityOnHand: true, location: { select: { code: true, name: true } } },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  res.json({
    data: products.map((p) => ({ ...p, stock: stockOf(p as never) })),
    pagination: { page: query.page, pageSize: query.pageSize, total, pages: Math.ceil(total / query.pageSize) },
  });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await prisma.product.findUnique({
    where: { id: paramId(req, 'id') },
    include: {
      category: true,
      brand: true,
      inventory: {
        where: { branchId: req.user!.branchId },
        include: { location: true },
      },
      inventoryTransactions: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });
  if (!product) throw ApiError.notFound('Product not found');

  res.json({ data: product });
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(createProductSchema, req.body);
  const data: Prisma.ProductCreateInput = {
    name: input.name,
    sku: input.sku.toUpperCase().trim(),
    partNumber: input.partNumber?.trim() ?? null,
    description: input.description,
    compatibility: input.compatibility?.trim() ?? null,
    purchasePrice: new Prisma.Decimal(input.purchasePrice),
    sellingPrice: new Prisma.Decimal(input.sellingPrice),
    minStockLevel: input.minStockLevel,
    reorderQty: input.reorderQty,
    unitOfMeasure: input.unitOfMeasure,
    barcode: input.barcode,
    status: input.status,
    category: { connect: { id: input.categoryId } },
    ...(input.brandId ? { brand: { connect: { id: input.brandId } } } : {}),
  };

  let product;
  try {
    product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({ data });

      // Ensure the product is visible in the creator's branch inventory
      // (zero on hand) so stock screens and low-stock alerts see it immediately.
      const location = await tx.storageLocation.findFirst({
        where: { branchId: req.user!.branchId, isActive: true },
        orderBy: { code: 'asc' },
      });
      if (location) {
        await tx.inventory.upsert({
          where: {
            branchId_productId_locationId: {
              branchId: req.user!.branchId,
              productId: created.id,
              locationId: location.id,
            },
          },
          update: {},
          create: {
            branchId: req.user!.branchId,
            productId: created.id,
            locationId: location.id,
            quantityOnHand: 0,
          },
        });
      }

      return created;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw ApiError.conflict('A product with this SKU already exists');
    }
    throw err;
  }

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'CREATE',
    entityType: 'Product',
    entityId: product.id,
    newValue: scalarize(product),
  });

  res.status(201).json({ data: product });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.product.findUnique({ where: { id: paramId(req, 'id') } });
  if (!existing) throw ApiError.notFound('Product not found');

  const input = parseBody(updateProductSchema, req.body);
  const data: Prisma.ProductUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.sku !== undefined) data.sku = input.sku.toUpperCase().trim();
  if (input.partNumber !== undefined) data.partNumber = input.partNumber?.trim() ?? null;
  if (input.description !== undefined) data.description = input.description;
  if (input.compatibility !== undefined) data.compatibility = input.compatibility?.trim() ?? null;
  if (input.purchasePrice !== undefined) data.purchasePrice = new Prisma.Decimal(input.purchasePrice);
  if (input.sellingPrice !== undefined) data.sellingPrice = new Prisma.Decimal(input.sellingPrice);
  if (input.minStockLevel !== undefined) data.minStockLevel = input.minStockLevel;
  if (input.reorderQty !== undefined) data.reorderQty = input.reorderQty;
  if (input.unitOfMeasure !== undefined) data.unitOfMeasure = input.unitOfMeasure;
  if (input.barcode !== undefined) data.barcode = input.barcode;
  if (input.status !== undefined) data.status = input.status;
  if (input.categoryId !== undefined) data.category = { connect: { id: input.categoryId } };
  if (input.brandId !== undefined) {
    data.brand = input.brandId ? { connect: { id: input.brandId } } : { disconnect: true };
  }

  let product;
  try {
    product = await prisma.product.update({ where: { id: paramId(req, 'id') }, data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw ApiError.conflict('A product with this SKU already exists');
    }
    throw err;
  }

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'UPDATE',
    entityType: 'Product',
    entityId: product.id,
    previousValue: scalarize(existing),
    newValue: scalarize(product),
  });

  res.json({ data: product });
});

export const setProductStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = z
    .object({ status: z.enum(['ACTIVE', 'INACTIVE']) })
    .parse(req.body);
  const existing = await prisma.product.findUnique({ where: { id: paramId(req, 'id') } });
  if (!existing) throw ApiError.notFound('Product not found');

  const product = await prisma.product.update({
    where: { id: paramId(req, 'id') },
    data: { status },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'UPDATE',
    entityType: 'Product',
    entityId: product.id,
    previousValue: { status: existing.status },
    newValue: { status },
  });

  res.json({ data: product });
});