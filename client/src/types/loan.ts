export type LoanStatus = 'ACTIVE' | 'CLOSED' | 'DEFAULTED' | 'CANCELLED'
export type LoanInterestMethod = 'FLAT' | 'REDUCING_BALANCE' | 'FIXED_SCHEDULE'
export type RepaymentStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE'

export interface Loan {
  id: string
  lender: string
  reference: string | null
  branchId: string
  principalAmount: string
  interestRate: string
  interestMethod: LoanInterestMethod
  durationMonths: number
  startDate: string
  maturityDate: string | null
  totalExpectedInterest: string
  totalRepayment: string
  status: LoanStatus
  notes: string | null
  createdAt: string
  createdBy?: { id: string; fullName: string } | null
  _count?: { payments: number; schedules: number }
}

export interface LoanSchedule {
  id: string
  loanId: string
  installmentNo: number
  dueDate: string
  principalAmount: string
  interestAmount: string
  totalDue: string
  amountPaid: string
  status: RepaymentStatus
}

export interface LoanPayment {
  id: string
  loanId: string
  scheduleId: string | null
  amount: string
  paymentDate: string
  method: string
  reference: string | null
  note: string | null
  createdAt: string
}

export interface LoanDetail extends Loan {
  schedules: LoanSchedule[]
  payments: LoanPayment[]
}

export interface LoanInput {
  lender: string
  reference?: string | null
  principalAmount: number
  interestRate?: number
  interestMethod?: LoanInterestMethod
  durationMonths?: number
  startDate?: string
  maturityDate?: string | null
  totalExpectedInterest?: number
  totalRepayment?: number
  notes?: string | null
}

export interface LoanPaymentInput {
  amount: number
  scheduleId?: string | null
  method?: string
  reference?: string | null
  note?: string | null
  paymentDate?: string
}
