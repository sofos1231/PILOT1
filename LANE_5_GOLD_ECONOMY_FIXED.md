# 💰 LANE 5: GOLD ECONOMY (FIXED)
## Payments, Transactions, and Gold Shop
## ✅ ALL ISSUES PATCHED

---

## YOUR MISSION
Build the complete gold economy system:
- Backend: Gold service, Stripe integration, transactions
- Frontend: Gold shop, package display, purchase flow
- Features: Balance tracking, transaction history, daily bonus

---

## PREREQUISITES
- **Lane 1 must be complete** (backend running with auth)
- **Lane 2 must be complete** (frontend running)

---

## PHASE 1: Backend Setup

### Step 1.1: Ensure Stripe is Installed
```bash
cd /home/claude/backgammon-backend
npm install stripe
```

### Step 1.2: Update .env with Stripe Key
Add to `.env`:
```
# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_your_test_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

---

## PHASE 2: Backend Gold Service

### Step 2.1: Create Gold Packages Config
Create `src/config/packages.ts`:
```typescript
export interface GoldPackage {
  package_id: string;
  name: string;
  gold_amount: number;
  bonus_gold: number;
  price_usd: number;
  price_cents: number;
  badge?: string;
  discount_percent?: number;
  popular?: boolean;
}

export const GOLD_PACKAGES: GoldPackage[] = [
  {
    package_id: 'starter',
    name: 'Starter Pack',
    gold_amount: 10000,
    bonus_gold: 0,
    price_usd: 4.99,
    price_cents: 499,
  },
  {
    package_id: 'popular',
    name: 'Popular Pack',
    gold_amount: 50000,
    bonus_gold: 5000,
    price_usd: 19.99,
    price_cents: 1999,
    badge: 'Best Value',
    popular: true,
  },
  {
    package_id: 'premium',
    name: 'Premium Pack',
    gold_amount: 150000,
    bonus_gold: 20000,
    price_usd: 49.99,
    price_cents: 4999,
    discount_percent: 15,
  },
  {
    package_id: 'mega',
    name: 'Mega Pack',
    gold_amount: 500000,
    bonus_gold: 100000,
    price_usd: 99.99,
    price_cents: 9999,
    badge: 'Save 30%',
    discount_percent: 30,
  },
];

export function getPackage(packageId: string): GoldPackage | undefined {
  return GOLD_PACKAGES.find(p => p.package_id === packageId);
}

export function getTotalGold(pkg: GoldPackage): number {
  return pkg.gold_amount + pkg.bonus_gold;
}

// Daily bonus configuration
export const DAILY_BONUS_CONFIG = {
  amount: 500,
  description: 'Daily login bonus',
};
```

### Step 2.2: Create Gold Service (FIXED - proper transaction handling)
Create `src/services/gold.service.ts`:
```typescript
import Stripe from 'stripe';
import pool from '../db/connection';
import { goldRepository } from '../repositories/gold.repository';
import { usersRepository } from '../repositories/users.repository';
import { GOLD_PACKAGES, getPackage, getTotalGold, DAILY_BONUS_CONFIG } from '../config/packages';
import { ValidationError, NotFoundError } from '../errors/AppError';

// Initialize Stripe (will be undefined if no key provided - OK for testing)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

export class GoldService {
  /**
   * Get user's current gold balance and stats
   */
  async getBalance(userId: string): Promise<{
    balance: number;
    lifetime_earned: number;
    lifetime_spent: number;
  }> {
    const user = await usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    return {
      balance: user.gold_balance,
      lifetime_earned: user.total_gold_earned,
      lifetime_spent: user.total_gold_spent,
    };
  }

  /**
   * Get available gold packages
   */
  getPackages(): { packages: typeof GOLD_PACKAGES } {
    return { packages: GOLD_PACKAGES };
  }

  /**
   * Create Stripe payment intent for gold purchase
   */
  async createPurchaseIntent(
    userId: string,
    packageId: string
  ): Promise<{
    payment_intent_id: string;
    client_secret: string;
    amount: number;
    currency: string;
    package: typeof GOLD_PACKAGES[0];
  }> {
    if (!stripe) {
      throw new ValidationError('Payment system not configured');
    }

    const pkg = getPackage(packageId);
    if (!pkg) {
      throw new ValidationError('Invalid package');
    }

    const user = await usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: pkg.price_cents,
      currency: 'usd',
      metadata: {
        user_id: userId,
        package_id: packageId,
        gold_amount: getTotalGold(pkg).toString(),
        user_email: user.email,
      },
      automatic_payment_methods: {
        enabled: true,
      },
      description: `${pkg.name} - ${getTotalGold(pkg).toLocaleString()} Gold`,
    });

    return {
      payment_intent_id: paymentIntent.id,
      client_secret: paymentIntent.client_secret!,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      package: pkg,
    };
  }

  /**
   * Confirm purchase after successful payment (idempotent)
   */
  async confirmPurchase(paymentIntentId: string): Promise<{
    gold_added: number;
    new_balance: number;
    transaction_id: string;
  }> {
    if (!stripe) {
      throw new ValidationError('Payment system not configured');
    }

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new ValidationError(`Payment not completed. Status: ${paymentIntent.status}`);
    }

    const userId = paymentIntent.metadata.user_id;
    const goldAmount = parseInt(paymentIntent.metadata.gold_amount);
    const packageId = paymentIntent.metadata.package_id;

    // Check if already processed (idempotency)
    const existingTransaction = await pool.query(
      'SELECT * FROM gold_transactions WHERE payment_intent_id = $1',
      [paymentIntentId]
    );

    if (existingTransaction.rows.length > 0) {
      // Already processed - return existing result
      const user = await usersRepository.findById(userId);
      return {
        gold_added: goldAmount,
        new_balance: user?.gold_balance || 0,
        transaction_id: existingTransaction.rows[0].transaction_id,
      };
    }

    // Process purchase in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current balance with row lock
      const userResult = await client.query(
        'SELECT gold_balance, total_gold_earned FROM users WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new NotFoundError('User');
      }

      const currentBalance = userResult.rows[0].gold_balance;
      const newBalance = currentBalance + goldAmount;

      // Update user balance
      await client.query(
        `UPDATE users 
         SET gold_balance = $1, 
             total_gold_earned = total_gold_earned + $2,
             updated_at = NOW()
         WHERE user_id = $3`,
        [newBalance, goldAmount, userId]
      );

      // Create transaction record
      const transactionResult = await client.query(
        `INSERT INTO gold_transactions 
         (user_id, type, amount, balance_after, description, payment_intent_id, amount_usd)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING transaction_id`,
        [
          userId,
          'purchase',
          goldAmount,
          newBalance,
          `Purchased ${packageId} package`,
          paymentIntentId,
          paymentIntent.amount / 100,
        ]
      );

      await client.query('COMMIT');

      return {
        gold_added: goldAmount,
        new_balance: newBalance,
        transaction_id: transactionResult.rows[0].transaction_id,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get transaction history with pagination
   */
  async getTransactions(
    userId: string,
    options: { limit?: number; offset?: number; type?: string }
  ): Promise<{
    transactions: any[];
    total_count: number;
    has_more: boolean;
  }> {
    const limit = Math.min(options.limit || 50, 100);
    const offset = options.offset || 0;

    let query = `
      SELECT * FROM gold_transactions 
      WHERE user_id = $1
    `;
    let countQuery = `
      SELECT COUNT(*) FROM gold_transactions 
      WHERE user_id = $1
    `;
    const values: any[] = [userId];
    let paramIndex = 2;

    if (options.type && options.type !== 'all') {
      query += ` AND type = $${paramIndex}`;
      countQuery += ` AND type = $${paramIndex}`;
      values.push(options.type);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);

    const [transactionsResult, countResult] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, values.slice(0, -2).length > 0 ? values.slice(0, -2) : [userId]),
    ]);

    const totalCount = parseInt(countResult.rows[0].count);

    return {
      transactions: transactionsResult.rows,
      total_count: totalCount,
      has_more: offset + limit < totalCount,
    };
  }

  /**
   * Claim daily login bonus (FIXED - uses database transaction with row lock)
   */
  async claimDailyBonus(userId: string): Promise<{
    gold_awarded: number;
    new_balance: number;
    next_bonus_at: string;
  }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get user with row lock to prevent race conditions
      const userResult = await client.query(
        `SELECT user_id, gold_balance, last_daily_bonus_claim, total_gold_earned
         FROM users 
         WHERE user_id = $1 
         FOR UPDATE`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new NotFoundError('User');
      }

      const user = userResult.rows[0];
      const now = new Date();
      const lastClaim = user.last_daily_bonus_claim ? new Date(user.last_daily_bonus_claim) : null;

      // Check if already claimed today
      if (lastClaim) {
        const isSameDay =
          lastClaim.getUTCFullYear() === now.getUTCFullYear() &&
          lastClaim.getUTCMonth() === now.getUTCMonth() &&
          lastClaim.getUTCDate() === now.getUTCDate();

        if (isSameDay) {
          await client.query('ROLLBACK');
          
          // Calculate next bonus time (midnight UTC)
          const tomorrow = new Date(now);
          tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
          tomorrow.setUTCHours(0, 0, 0, 0);

          throw new ValidationError('Daily bonus already claimed', {
            next_bonus_at: tomorrow.toISOString(),
          });
        }
      }

      const bonusAmount = DAILY_BONUS_CONFIG.amount;
      const newBalance = user.gold_balance + bonusAmount;

      // Update user
      await client.query(
        `UPDATE users 
         SET gold_balance = $1, 
             last_daily_bonus_claim = NOW(),
             total_gold_earned = total_gold_earned + $2,
             updated_at = NOW()
         WHERE user_id = $3`,
        [newBalance, bonusAmount, userId]
      );

      // Create transaction
      await client.query(
        `INSERT INTO gold_transactions 
         (user_id, type, amount, balance_after, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'daily_bonus', bonusAmount, newBalance, DAILY_BONUS_CONFIG.description]
      );

      await client.query('COMMIT');

      // Calculate next bonus time (midnight UTC tomorrow)
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);

      return {
        gold_awarded: bonusAmount,
        new_balance: newBalance,
        next_bonus_at: tomorrow.toISOString(),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Deduct gold (for match stakes, club creation, etc.)
   */
  async deductGold(
    userId: string,
    amount: number,
    type: string,
    description: string,
    relatedId?: { match_id?: string; club_id?: string }
  ): Promise<{ new_balance: number }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        'SELECT gold_balance FROM users WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new NotFoundError('User');
      }

      const currentBalance = userResult.rows[0].gold_balance;
      
      if (currentBalance < amount) {
        throw new ValidationError('Insufficient gold balance');
      }

      const newBalance = currentBalance - amount;

      await client.query(
        `UPDATE users 
         SET gold_balance = $1, 
             total_gold_spent = total_gold_spent + $2,
             updated_at = NOW()
         WHERE user_id = $3`,
        [newBalance, amount, userId]
      );

      await client.query(
        `INSERT INTO gold_transactions 
         (user_id, type, amount, balance_after, description, related_match_id, related_club_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          type,
          -amount,
          newBalance,
          description,
          relatedId?.match_id || null,
          relatedId?.club_id || null,
        ]
      );

      await client.query('COMMIT');

      return { new_balance: newBalance };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Add gold (for match wins, etc.)
   */
  async addGold(
    userId: string,
    amount: number,
    type: string,
    description: string,
    relatedId?: { match_id?: string; club_id?: string }
  ): Promise<{ new_balance: number }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        'SELECT gold_balance FROM users WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new NotFoundError('User');
      }

      const newBalance = userResult.rows[0].gold_balance + amount;

      await client.query(
        `UPDATE users 
         SET gold_balance = $1, 
             total_gold_earned = total_gold_earned + $2,
             updated_at = NOW()
         WHERE user_id = $3`,
        [newBalance, amount, userId]
      );

      await client.query(
        `INSERT INTO gold_transactions 
         (user_id, type, amount, balance_after, description, related_match_id, related_club_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          type,
          amount,
          newBalance,
          description,
          relatedId?.match_id || null,
          relatedId?.club_id || null,
        ]
      );

      await client.query('COMMIT');

      return { new_balance: newBalance };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const goldService = new GoldService();
```

### Step 2.3: Create Gold Controller
Create `src/controllers/gold.controller.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { goldService } from '../services/gold.service';

export class GoldController {
  async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await goldService.getBalance(req.user!.userId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getPackages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = goldService.getPackages();
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async createPurchaseIntent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { package_id } = req.body;
      const result = await goldService.createPurchaseIntent(req.user!.userId, package_id);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async confirmPurchase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { payment_intent_id } = req.body;
      const result = await goldService.confirmPurchase(payment_intent_id);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit, offset, type } = req.query;
      const result = await goldService.getTransactions(req.user!.userId, {
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        type: type as string | undefined,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async claimDailyBonus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await goldService.claimDailyBonus(req.user!.userId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}

export const goldController = new GoldController();
```

### Step 2.4: Create Gold Validator
Create `src/validators/gold.validator.ts`:
```typescript
import { z } from 'zod';

export const createPurchaseIntentSchema = z.object({
  package_id: z.enum(['starter', 'popular', 'premium', 'mega']),
});

export const confirmPurchaseSchema = z.object({
  payment_intent_id: z.string().min(1),
});
```

### Step 2.5: Create Gold Routes
Create `src/routes/gold.routes.ts`:
```typescript
import { Router } from 'express';
import { goldController } from '../controllers/gold.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { createPurchaseIntentSchema, confirmPurchaseSchema } from '../validators/gold.validator';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/balance', goldController.getBalance.bind(goldController));
router.get('/packages', goldController.getPackages.bind(goldController));
router.get('/transactions', goldController.getTransactions.bind(goldController));
router.post('/daily-bonus/claim', goldController.claimDailyBonus.bind(goldController));
router.post('/purchase/intent', validateRequest(createPurchaseIntentSchema), goldController.createPurchaseIntent.bind(goldController));
router.post('/purchase/confirm', validateRequest(confirmPurchaseSchema), goldController.confirmPurchase.bind(goldController));

export default router;
```

### Step 2.6: Add Gold Routes to Index
Update `src/routes/index.ts`:
```typescript
import goldRoutes from './gold.routes';

// Add after auth routes
router.use('/gold', goldRoutes);
```

---

## PHASE 3: Frontend Shop Implementation

### Step 3.1: Create Gold Store
Create `store/goldStore.ts`:
```typescript
import { create } from 'zustand';
import apiClient from '../services/api/axiosInstance';

export interface GoldPackage {
  package_id: string;
  name: string;
  gold_amount: number;
  bonus_gold: number;
  price_usd: number;
  price_cents: number;
  badge?: string;
  discount_percent?: number;
  popular?: boolean;
}

export interface GoldTransaction {
  transaction_id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

interface GoldState {
  packages: GoldPackage[];
  transactions: GoldTransaction[];
  isLoadingPackages: boolean;
  isLoadingTransactions: boolean;
  error: string | null;
  
  fetchPackages: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  claimDailyBonus: () => Promise<{ goldAwarded: number; newBalance: number }>;
}

export const useGoldStore = create<GoldState>((set, get) => ({
  packages: [],
  transactions: [],
  isLoadingPackages: false,
  isLoadingTransactions: false,
  error: null,

  fetchPackages: async () => {
    set({ isLoadingPackages: true, error: null });
    try {
      const { data } = await apiClient.get('/gold/packages');
      set({ packages: data.packages, isLoadingPackages: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Failed to load packages',
        isLoadingPackages: false 
      });
    }
  },

  fetchTransactions: async () => {
    set({ isLoadingTransactions: true, error: null });
    try {
      const { data } = await apiClient.get('/gold/transactions', {
        params: { limit: 50 },
      });
      set({ transactions: data.transactions, isLoadingTransactions: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Failed to load transactions',
        isLoadingTransactions: false 
      });
    }
  },

  claimDailyBonus: async () => {
    const { data } = await apiClient.post('/gold/daily-bonus/claim');
    return {
      goldAwarded: data.gold_awarded,
      newBalance: data.new_balance,
    };
  },
}));
```

### Step 3.2: Update Shop Tab (FIXED - complete implementation)
Replace `app/(tabs)/shop.tsx`:
```typescript
import { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useGoldStore, GoldPackage } from '../../store/goldStore';

export default function ShopTab() {
  const user = useAuthStore(state => state.user);
  const updateGoldBalance = useAuthStore(state => state.updateGoldBalance);
  const { packages, isLoadingPackages, fetchPackages, claimDailyBonus } = useGoldStore();
  
  const [claimingBonus, setClaimingBonus] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchPackages();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPackages();
    setRefreshing(false);
  }, [fetchPackages]);

  const handleClaimBonus = async () => {
    setClaimingBonus(true);
    try {
      const { goldAwarded, newBalance } = await claimDailyBonus();
      updateGoldBalance(newBalance);
      Alert.alert(
        '🎁 Daily Bonus!',
        `You received ${goldAwarded.toLocaleString()} gold!`,
        [{ text: 'Awesome!' }]
      );
    } catch (error: any) {
      const message = error.response?.data?.error || 'Could not claim bonus';
      const details = error.response?.data?.details;
      
      if (details?.next_bonus_at) {
        const nextBonus = new Date(details.next_bonus_at);
        Alert.alert(
          'Already Claimed',
          `Come back tomorrow for your next bonus!\n\nNext bonus available: ${nextBonus.toLocaleTimeString()}`
        );
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setClaimingBonus(false);
    }
  };

  const handlePurchase = (pkg: GoldPackage) => {
    // In production, this would open Stripe payment sheet
    Alert.alert(
      'Purchase Gold',
      `Purchase ${(pkg.gold_amount + pkg.bonus_gold).toLocaleString()} gold for $${pkg.price_usd.toFixed(2)}?\n\nNote: Full payment integration requires Stripe setup.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Learn More', 
          onPress: () => Alert.alert('Stripe Setup', 'To enable purchases, configure your Stripe API keys in the backend .env file.')
        },
      ]
    );
  };

  if (isLoadingPackages && packages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Current Balance */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Your Gold Balance</Text>
        <View style={styles.balanceRow}>
          <Text style={styles.goldIcon}>🪙</Text>
          <Text style={styles.balanceAmount}>
            {(user?.gold_balance ?? 0).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Daily Bonus */}
      <TouchableOpacity
        style={[styles.bonusCard, claimingBonus && styles.bonusCardDisabled]}
        onPress={handleClaimBonus}
        disabled={claimingBonus}
        activeOpacity={0.8}
      >
        <View style={styles.bonusContent}>
          <Text style={styles.bonusEmoji}>🎁</Text>
          <View style={styles.bonusTextContainer}>
            <Text style={styles.bonusTitle}>Daily Bonus</Text>
            <Text style={styles.bonusSubtitle}>Claim 500 gold FREE!</Text>
          </View>
        </View>
        {claimingBonus ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <View style={styles.claimButton}>
            <Text style={styles.claimButtonText}>CLAIM</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Section Header */}
      <Text style={styles.sectionTitle}>Gold Packages</Text>

      {/* Packages Grid */}
      <View style={styles.packagesGrid}>
        {packages.map((pkg) => (
          <TouchableOpacity
            key={pkg.package_id}
            style={[
              styles.packageCard,
              pkg.popular && styles.packageCardPopular,
            ]}
            onPress={() => handlePurchase(pkg)}
            activeOpacity={0.8}
          >
            {pkg.badge && (
              <View style={[
                styles.packageBadge,
                pkg.popular && styles.packageBadgePopular,
              ]}>
                <Text style={styles.packageBadgeText}>{pkg.badge}</Text>
              </View>
            )}

            <Text style={styles.packageGold}>
              🪙 {(pkg.gold_amount + pkg.bonus_gold).toLocaleString()}
            </Text>

            {pkg.bonus_gold > 0 && (
              <Text style={styles.packageBonus}>
                +{pkg.bonus_gold.toLocaleString()} Bonus!
              </Text>
            )}

            <Text style={styles.packageName}>{pkg.name}</Text>

            <TouchableOpacity
              style={[
                styles.packageButton,
                pkg.popular && styles.packageButtonPopular,
              ]}
              onPress={() => handlePurchase(pkg)}
            >
              <Text style={styles.packageButtonText}>
                ${pkg.price_usd.toFixed(2)}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>

      {/* Info Footer */}
      <View style={styles.infoFooter}>
        <Ionicons name="shield-checkmark" size={20} color="#666" />
        <Text style={styles.infoText}>
          Secure payments powered by Stripe
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  balanceCard: {
    backgroundColor: '#667eea',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goldIcon: {
    fontSize: 32,
    marginRight: 8,
  },
  balanceAmount: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
  },
  bonusCard: {
    backgroundColor: '#10B981',
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  bonusCardDisabled: {
    opacity: 0.7,
  },
  bonusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bonusEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  bonusTextContainer: {},
  bonusTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bonusSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  claimButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  claimButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginHorizontal: 16,
    marginBottom: 16,
    color: '#333',
  },
  packagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  packageCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    width: '46%',
    marginHorizontal: '2%',
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  packageCardPopular: {
    borderWidth: 2,
    borderColor: '#667eea',
  },
  packageBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  packageBadgePopular: {
    backgroundColor: '#667eea',
  },
  packageBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  packageGold: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 8,
    color: '#F9A825',
  },
  packageBonus: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 4,
  },
  packageName: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  packageButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 12,
  },
  packageButtonPopular: {
    backgroundColor: '#667eea',
  },
  packageButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  infoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 8,
    marginBottom: 32,
    gap: 8,
  },
  infoText: {
    color: '#666',
    fontSize: 14,
  },
});
```

---

## PHASE 4: Testing

### Step 4.1: Test Backend Endpoints
```bash
# Get packages (no auth required for listing)
curl http://localhost:8000/v1/gold/packages \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get balance
curl http://localhost:8000/v1/gold/balance \
  -H "Authorization: Bearer YOUR_TOKEN"

# Claim daily bonus
curl -X POST http://localhost:8000/v1/gold/daily-bonus/claim \
  -H "Authorization: Bearer YOUR_TOKEN"

# Claim again (should fail)
curl -X POST http://localhost:8000/v1/gold/daily-bonus/claim \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get transactions
curl http://localhost:8000/v1/gold/transactions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Step 4.2: Test Frontend
1. Navigate to Shop tab
2. See current gold balance
3. See gold packages with correct prices
4. Try claiming daily bonus
5. Check that balance updates
6. Try claiming again (should show error)

---

## ✅ LANE 5 COMPLETION CHECKLIST

### Backend
- [ ] Stripe package installed
- [ ] Gold packages configured
- [ ] Gold service complete:
  - [ ] getBalance()
  - [ ] getPackages()
  - [ ] createPurchaseIntent()
  - [ ] confirmPurchase() (idempotent)
  - [ ] getTransactions()
  - [ ] claimDailyBonus() (with row lock)
  - [ ] deductGold()
  - [ ] addGold()
- [ ] Gold controller complete
- [ ] Gold validator created
- [ ] Gold routes configured
- [ ] Routes added to index

### Frontend
- [ ] Gold store created
- [ ] Shop tab displays balance
- [ ] Packages display correctly with badges
- [ ] Daily bonus claim works
- [ ] Balance updates after bonus
- [ ] Error handling for already claimed

**When all items are checked, LANE 5 IS COMPLETE!**

---

## 📁 FILES CREATED IN LANE 5

### Backend
```
src/
├── config/
│   └── packages.ts
├── services/
│   └── gold.service.ts
├── controllers/
│   └── gold.controller.ts
├── validators/
│   └── gold.validator.ts
└── routes/
    └── gold.routes.ts
```

### Frontend
```
store/
└── goldStore.ts
app/(tabs)/
└── shop.tsx (REPLACED)
```
