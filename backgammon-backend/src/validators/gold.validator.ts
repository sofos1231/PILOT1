import { z } from 'zod';

export const createPurchaseIntentSchema = z.object({
  package_id: z.enum(['starter', 'popular', 'premium', 'mega']),
});

export const confirmPurchaseSchema = z.object({
  payment_intent_id: z.string().min(1),
});
