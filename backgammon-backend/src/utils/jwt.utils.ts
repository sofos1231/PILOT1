import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error('JWT secrets must be defined in environment variables');
}

export interface JWTPayload {
  userId: string;
  email: string;
}

export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: '15m' });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId }, REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, ACCESS_SECRET) as JWTPayload;
}

export function verifyRefreshToken(token: string): { userId: string } {
  return jwt.verify(token, REFRESH_SECRET) as { userId: string };
}
