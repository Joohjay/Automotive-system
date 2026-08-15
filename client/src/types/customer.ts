export type CustomerType = 'RETAIL' | 'WHOLESALE'
export type CreditStatus = 'OPEN' | 'ON_HOLD' | 'CLOSED'
export type CustomerStatus = 'ACTIVE' | 'INACTIVE'

export interface CreditAccount {
  id: string
  customerId: string
  creditLimit: string
  outstandingBalance: string
  status: CreditStatus
}

export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  customerType: CustomerType
  creditEligible: boolean
  creditLimit: string
  status: CustomerStatus
  createdAt: string
  creditAccount?: CreditAccount | null
}

export interface CreditPayment {
  id: string
  creditAccountId: string
  amount: string
  method: 'CASH' | 'MPESA' | 'OTHER'
  reference: string | null
  paidAt: string
  note: string | null
}

export interface CustomerDetail extends Customer {
  creditAccount?: (CreditAccount & { creditPayments: CreditPayment[] }) | null
  sales?: {
    id: string
    receiptNumber: string
    total: string
    status: string
    saleDate: string
  }[]
}

export interface CustomerInput {
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  customerType: CustomerType
  creditEligible: boolean
  creditLimit: number | string
  status: CustomerStatus
}

export interface CreditPaymentInput {
  amount: number | string
  method?: 'CASH' | 'MPESA' | 'OTHER'
  reference?: string | null
  note?: string | null
}
