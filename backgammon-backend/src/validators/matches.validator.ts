import { z } from 'zod';

export const createMatchSchema = z.object({
  match_type: z.enum(['gold', 'club']),
  stake_amount: z.number().int().min(100).max(1000000),
  club_id: z.string().uuid().optional(),
  doubling_cube_enabled: z.boolean().optional().default(true),
});

export const submitMovesSchema = z.object({
  moves: z.array(z.object({
    from: z.number().int().min(-1).max(23),
    to: z.number().int().min(-1).max(23),
    die_value: z.number().int().min(1).max(6),
  })).min(0).max(4),
});
