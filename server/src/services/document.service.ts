import type { Prisma } from '@prisma/client';

const pad = (n: number, len: number) => String(n).padStart(len, '0');

/**
 * Generates the next sequential document number for a branch, scoped to the
 * current day: `<PREFIX>-YYYYMMDD-<seq>` (e.g. RCP-20260815-001). Must be called
 * inside the same transaction that creates the document.
 */
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  branchId: string,
  prefix: string,
  model: 'sale' | 'return',
): Promise<string> {
  const now = new Date();
  const yyyymmdd = `${now.getFullYear()}${pad(now.getMonth() + 1, 2)}${pad(now.getDate(), 2)}`;
  const scope = `${prefix}-${yyyymmdd}`;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 86_400_000);

  const numField = model === 'sale' ? 'receiptNumber' : 'returnNumber';
  const dateField = model === 'sale' ? 'saleDate' : 'returnDate';
  const client = tx as unknown as Record<
    string,
    {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    }
  >;

  const finder = client[model];
  if (!finder) throw new Error(`Unknown document model: ${model}`);
  const last = await finder.findFirst({
    where: {
      branchId,
      [numField]: { startsWith: scope },
      [dateField]: { gte: start, lt: end },
    },
    orderBy: { createdAt: 'desc' },
    select: { [numField]: true },
  });

  const lastNum = last ? last[numField] : undefined;
  const seq = lastNum ? parseInt(String(lastNum).split('-').pop() ?? '0', 10) + 1 : 1;
  return `${scope}-${pad(seq, 3)}`;
}

export function todayRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start, end: new Date(start.getTime() + 86_400_000) };
}