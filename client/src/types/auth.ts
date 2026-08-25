export interface AuthUser {
  id: string
  email: string
  fullName: string
  roleId: string
  roleName: string
  branchId: string
}

export interface AppSettings {
  businessName: string
  currency: string
  receiptFooter: string
}

export interface AuthResponse {
  mustChangePassword: boolean
  mfaRequired?: boolean
  user: AuthUser
  permissions: string[]
  settings: AppSettings
}

export interface MeResponse {
  user: AuthUser
  mustChangePassword: boolean
  mfaEnabled?: boolean
  permissions: string[]
  lastLoginAt: string | null
  branchName: string
  settings: AppSettings
}