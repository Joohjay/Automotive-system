export type ShiftStatus = 'OPEN' | 'CLOSED'

export interface Shift {
  id: string
  branchId: string
  createdById: string | null
  openingCash: string
  expectedClosingCash: string | null
  actualClosingCash: string | null
  difference: string | null
  openedAt: string
  closedAt: string | null
  status: ShiftStatus
  notes: string | null
  createdAt: string
  createdBy?: { id: string; fullName: string } | null
}

export interface ShiftSummary {
  openShift: Shift | null
  totalSales?: number
  totalCashReceived?: number
  totalMpesaReceived?: number
  transactionCount?: number
}

export interface OpenShiftInput {
  openingCash?: number
  notes?: string | null
}

export interface CloseShiftInput {
  actualClosingCash: number
  notes?: string | null
}
