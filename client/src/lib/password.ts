export function validatePassword(password: string): string | null {
  if (password.length < 12) return 'Password must be at least 12 characters';
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter';
  if (!/\d/.test(password)) return 'Password must include a number';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return 'Password must include a special character';
  return null;
}

export const PASSWORD_HINT = 'Min 12 characters with uppercase, lowercase, number, and special character (!@#$%^&*...)';
