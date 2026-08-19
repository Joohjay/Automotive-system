import type { Prisma } from '@prisma/client';

const pad = (n: number, len: number) => String(n).padStart(len, '0');

/**
 * Generates the next sequential document number for a branch, scoped to the
 * current day: `<PREFIX>-YYYYMMDD-<seq>` (e.g. RCP-20260815-001). Must be called
 * inside the same transaction that creates the document.
 *
 * The sequence is stored in the `DocumentCounter` table and advanced with a
 * single atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, so concurrent
 * requests can never receive the same number. Because the counter is advanced in
 * the same transaction as the document itself, a rolled-back transaction also
 * rolls back its sequence increment — no duplicates, at worst a gap.
 */
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  branchId: string,
  prefix: 'RCP' | 'RET',
): Promise<string> {
  const now = new Date();
  const day = `${now.getFullYear()}${pad(now.getMonth() + 1, 2)}${pad(now.getDate(), 2)}`;

  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "DocumentCounter" ("branchId", "prefix", "day", "value", "updatedAt")
    VALUES (${branchId}, ${prefix}, ${day}, 1, now())
    ON CONFLICT ("branchId", "prefix", "day")
    DO UPDATE SET "value" = "DocumentCounter"."value" + 1, "updatedAt" = now()
    RETURNING "value"
  `;

  const seq = rows[0]?.value ?? 1;
  return `${prefix}-${day}-${pad(seq, 3)}`;
}

export function todayRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start, end: new Date(start.getTime() + 86_400_000) };
}