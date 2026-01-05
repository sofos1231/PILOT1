import { z } from 'zod';

export const createClubSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be at most 50 characters'),
  description: z.string().max(500).optional(),
  logo_url: z.string().url().optional().nullable(),
  privacy: z.enum(['public', 'private']).optional(),
  welcome_bonus: z.number().min(0).max(100000).optional(),
});

export const updateClubSchema = z.object({
  name: z.string().min(3).max(50).optional(),
  description: z.string().max(500).optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  privacy: z.enum(['public', 'private']).optional(),
  welcome_bonus: z.number().min(0).max(100000).optional(),
});

export const grantChipsSchema = z.object({
  user_id: z.string().uuid(),
  amount: z.number().positive().max(10000),
  reason: z.string().max(200).optional(),
});

export const createTableSchema = z.object({
  stake_amount: z.number().positive(),
});
