import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be at most 100 characters'),
  avatar_url: z.string().url().optional().nullable(),
  country: z.string().length(3, 'Country code must be 3 characters'),
  age_confirmed: z.boolean().refine(val => val === true, 'Age confirmation is required'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});
