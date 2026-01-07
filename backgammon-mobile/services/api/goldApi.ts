import apiClient from './axiosInstance';

// ==================== TYPES ====================

export interface GoldPackage {
  id: string;
  name: string;
  gold_amount: number;
  price_usd: number;
  bonus_percent: number;
  popular?: boolean;
}

export interface GoldTransaction {
  transaction_id: string;
  user_id: string;
  type: 'purchase' | 'match_win' | 'match_loss' | 'daily_bonus' | 'club_creation' | 'refund' | 'admin_grant';
  amount: number;
  balance_after: number;
  description: string;
  payment_intent_id?: string;
  related_match_id?: string;
  related_club_id?: string;
  created_at: string;
}

export interface GoldBalance {
  balance: number;
  last_daily_bonus_claim: string | null;
  can_claim_daily_bonus: boolean;
}

export interface DailyBonusResponse {
  success: boolean;
  amount: number;
  new_balance: number;
  next_claim_at: string;
}

export interface PurchaseIntentResponse {
  success: boolean;
  client_secret: string;
  payment_intent_id: string;
  amount_usd: number;
  gold_amount: number;
}

export interface PurchaseConfirmResponse {
  success: boolean;
  gold_added: number;
  new_balance: number;
  transaction_id: string;
}

// ==================== API FUNCTIONS ====================

export const goldApi = {
  /**
   * Get user's current gold balance and daily bonus status
   */
  getBalance: () =>
    apiClient.get<{ success: boolean; balance: number; can_claim_daily_bonus: boolean }>(
      '/gold/balance'
    ),

  /**
   * Get available gold packages for purchase
   */
  getPackages: () =>
    apiClient.get<{ success: boolean; packages: GoldPackage[] }>('/gold/packages'),

  /**
   * Get user's gold transaction history
   */
  getTransactions: (limit: number = 50, offset: number = 0) =>
    apiClient.get<{ success: boolean; transactions: GoldTransaction[]; total: number }>(
      '/gold/transactions',
      { params: { limit, offset } }
    ),

  /**
   * Claim daily bonus (500 gold, once per day)
   */
  claimDailyBonus: () =>
    apiClient.post<DailyBonusResponse>('/gold/daily-bonus/claim'),

  /**
   * Create Stripe payment intent for gold purchase
   */
  createPurchaseIntent: (packageId: string) =>
    apiClient.post<PurchaseIntentResponse>('/gold/purchase/intent', {
      package_id: packageId,
    }),

  /**
   * Confirm purchase after Stripe payment completes
   */
  confirmPurchase: (paymentIntentId: string) =>
    apiClient.post<PurchaseConfirmResponse>('/gold/purchase/confirm', {
      payment_intent_id: paymentIntentId,
    }),
};

export default goldApi;
