export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  return null;
}

export const PASSWORD_HINT = 'At least 8 characters';
