export type ExpensePaymentMethod = 'CASH' | 'MPESA' | 'CREDIT' | 'OTHER'

export interface ExpenseCategory {
  id: string
  name: string
  description: string | null
  isActive: boolean
  branchId: string | null
  createdAt: string
}

export interface Expense {
  id: string
  branchId: string
  categoryId: string
  description: string
  amount: string
  expenseDate: string
  paymentMethod: ExpensePaymentMethod
  reference: string | null
  note: string | null
  createdAt: string
  category: { id: string; name: string }
  createdBy?: { id: string; fullName: string } | null
}

export interface ExpenseInput {
  categoryId: string
  description: string
  amount: number
  expenseDate?: string
  paymentMethod?: ExpensePaymentMethod
  reference?: string | null
  note?: string | null
}

export interface ExpenseCategoryInput {
  name: string
  description?: string | null
}
