import type { Request, Response } from 'express';
import { z } from 'zod';

import prisma from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paramId, parseQuery } from '../utils/validate.js';

const notificationQuerySchema = z.object({
  status: z.enum(['UNREAD', 'READ']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { status, page, pageSize } = parseQuery(notificationQuerySchema, req.query);

  const where = { userId, ...(status ? { status } : {}) };

  const [data, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, status: 'UNREAD' } }),
  ]);

  res.json({
    data,
    pagination: {
      page,
      pageSize,
      total,
      pages: Math.ceil(total / pageSize),
    },
    unreadCount,
  });
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const id = paramId(req, 'id');

  const notification = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notification) throw ApiError.notFound('Notification not found');

  const data = await prisma.notification.update({
    where: { id },
    data: { status: 'READ', readAt: new Date() },
  });

  res.json({ data });
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const result = await prisma.notification.updateMany({
    where: { userId, status: 'UNREAD' },
    data: { status: 'READ', readAt: new Date() },
  });

  res.json({ data: { updated: result.count } });
});
