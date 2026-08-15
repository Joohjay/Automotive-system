export function formatMoney(
  value: string | number | null | undefined,
  currency = 'TZS',
): string {
  if (value === null || value === undefined) return `${currency} 0`
  const n = Number(value)
  if (!Number.isFinite(n)) return `${currency} 0`
  return `${currency} ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}