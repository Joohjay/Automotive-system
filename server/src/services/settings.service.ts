import prisma from '../lib/prisma.js';

/**
 * Reads settings from the key-value store. Global settings have branchId null;
 * branch settings override globals.
 */
export async function getSettings(branchId?: string): Promise<Record<string, unknown>> {
  const rows = await prisma.setting.findMany({
    where: branchId ? { OR: [{ branchId: null }, { branchId }] } : { branchId: null },
  });

  const global: Record<string, unknown> = {};
  const branch: Record<string, unknown> = {};
  for (const row of rows) {
    if (row.branchId === null) global[row.key] = row.value;
    else branch[row.key] = row.value;
  }
  return { ...global, ...branch };
}

export async function getSetting(key: string): Promise<unknown> {
  const row = await prisma.setting.findFirst({ where: { key, branchId: null } });
  return row?.value;
}