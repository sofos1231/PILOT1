import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12; // Increased from 10 for better security

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
