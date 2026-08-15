import { Router } from 'express';

import prisma from '../lib/prisma.js';
import { config } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth());

router.post(
  '/cleanup',
  asyncHandler(async (req, res) => {
    if (!config.isDevelopment) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
      return;
    }
    const { productId, categoryId, brandId, locationId } = req.body as Record<string, string | undefined>;
    if (productId) {
      await prisma.inventoryTransaction.deleteMany({ where: { productId } });
      await prisma.inventory.deleteMany({ where: { productId } });
      await prisma.product.delete({ where: { id: productId } }).catch(() => undefined);
    }
    if (categoryId) await prisma.category.delete({ where: { id: categoryId } }).catch(() => undefined);
    if (brandId) await prisma.brand.delete({ where: { id: brandId } }).catch(() => undefined);
    if (locationId) {
      await prisma.storageLocation.delete({ where: { id: locationId } }).catch(() => undefined);
    }
    res.json({ ok: true });
  }),
);

export default router;