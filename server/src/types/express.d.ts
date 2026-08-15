declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roleId: string;
  roleName: string;
  branchId: string;
  permissions: string[];
}

export {};