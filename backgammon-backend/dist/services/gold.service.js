"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.goldService = exports.GoldService = void 0;
const stripe_1 = __importDefault(require("stripe"));
const connection_1 = __importDefault(require("../db/connection"));
const users_repository_1 = require("../repositories/users.repository");
const packages_1 = require("../config/packages");
const AppError_1 = require("../errors/AppError");
// Initialize Stripe (will be undefined if no key provided - OK for testing)
const stripe = process.env.STRIPE_SECRET_KEY
    ? new stripe_1.default(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-12-15.clover' })
    : null;
class GoldService {
    /**
     * Get user's current gold balance and stats
     */
    async getBalance(userId) {
        const user = await users_repository_1.usersRepository.findById(userId);
        if (!user) {
            throw new AppError_1.NotFoundError('User');
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
    getPackages() {
        return { packages: packages_1.GOLD_PACKAGES };
    }
    /**
     * Create Stripe payment intent for gold purchase
     */
    async createPurchaseIntent(userId, packageId) {
        if (!stripe) {
            throw new AppError_1.ValidationError('Payment system not configured');
        }
        const pkg = (0, packages_1.getPackage)(packageId);
        if (!pkg) {
            throw new AppError_1.ValidationError('Invalid package');
        }
        const user = await users_repository_1.usersRepository.findById(userId);
        if (!user) {
            throw new AppError_1.NotFoundError('User');
        }
        // Create Stripe payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: pkg.price_cents,
            currency: 'usd',
            metadata: {
                user_id: userId,
                package_id: packageId,
                gold_amount: (0, packages_1.getTotalGold)(pkg).toString(),
                user_email: user.email,
            },
            automatic_payment_methods: {
                enabled: true,
            },
            description: `${pkg.name} - ${(0, packages_1.getTotalGold)(pkg).toLocaleString()} Gold`,
        });
        return {
            payment_intent_id: paymentIntent.id,
            client_secret: paymentIntent.client_secret,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            package: pkg,
        };
    }
    /**
     * Confirm purchase after successful payment (idempotent)
     */
    async confirmPurchase(paymentIntentId) {
        if (!stripe) {
            throw new AppError_1.ValidationError('Payment system not configured');
        }
        // Verify payment with Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== 'succeeded') {
            throw new AppError_1.ValidationError(`Payment not completed. Status: ${paymentIntent.status}`);
        }
        const userId = paymentIntent.metadata.user_id;
        const goldAmount = parseInt(paymentIntent.metadata.gold_amount);
        const packageId = paymentIntent.metadata.package_id;
        // Check if already processed (idempotency)
        const existingTransaction = await connection_1.default.query('SELECT * FROM gold_transactions WHERE payment_intent_id = $1', [paymentIntentId]);
        if (existingTransaction.rows.length > 0) {
            // Already processed - return existing result
            const user = await users_repository_1.usersRepository.findById(userId);
            return {
                gold_added: goldAmount,
                new_balance: user?.gold_balance || 0,
                transaction_id: existingTransaction.rows[0].transaction_id,
            };
        }
        // Process purchase in a transaction
        const client = await connection_1.default.connect();
        try {
            await client.query('BEGIN');
            // Get current balance with row lock
            const userResult = await client.query('SELECT gold_balance, total_gold_earned FROM users WHERE user_id = $1 FOR UPDATE', [userId]);
            if (userResult.rows.length === 0) {
                throw new AppError_1.NotFoundError('User');
            }
            const currentBalance = userResult.rows[0].gold_balance;
            const newBalance = currentBalance + goldAmount;
            // Update user balance
            await client.query(`UPDATE users
         SET gold_balance = $1,
             total_gold_earned = total_gold_earned + $2,
             updated_at = NOW()
         WHERE user_id = $3`, [newBalance, goldAmount, userId]);
            // Create transaction record
            const transactionResult = await client.query(`INSERT INTO gold_transactions
         (user_id, type, amount, balance_after, description, payment_intent_id, amount_usd)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING transaction_id`, [
                userId,
                'purchase',
                goldAmount,
                newBalance,
                `Purchased ${packageId} package`,
                paymentIntentId,
                paymentIntent.amount / 100,
            ]);
            await client.query('COMMIT');
            return {
                gold_added: goldAmount,
                new_balance: newBalance,
                transaction_id: transactionResult.rows[0].transaction_id,
            };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Get transaction history with pagination
     */
    async getTransactions(userId, options) {
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
        const values = [userId];
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
            connection_1.default.query(query, values),
            connection_1.default.query(countQuery, values.slice(0, -2).length > 0 ? values.slice(0, -2) : [userId]),
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
    async claimDailyBonus(userId) {
        const client = await connection_1.default.connect();
        try {
            await client.query('BEGIN');
            // Get user with row lock to prevent race conditions
            const userResult = await client.query(`SELECT user_id, gold_balance, last_daily_bonus_claim, total_gold_earned
         FROM users
         WHERE user_id = $1
         FOR UPDATE`, [userId]);
            if (userResult.rows.length === 0) {
                throw new AppError_1.NotFoundError('User');
            }
            const user = userResult.rows[0];
            const now = new Date();
            const lastClaim = user.last_daily_bonus_claim ? new Date(user.last_daily_bonus_claim) : null;
            // Check if already claimed today
            if (lastClaim) {
                const isSameDay = lastClaim.getUTCFullYear() === now.getUTCFullYear() &&
                    lastClaim.getUTCMonth() === now.getUTCMonth() &&
                    lastClaim.getUTCDate() === now.getUTCDate();
                if (isSameDay) {
                    await client.query('ROLLBACK');
                    // Calculate next bonus time (midnight UTC)
                    const tomorrow = new Date(now);
                    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
                    tomorrow.setUTCHours(0, 0, 0, 0);
                    throw new AppError_1.ValidationError('Daily bonus already claimed', {
                        next_bonus_at: tomorrow.toISOString(),
                    });
                }
            }
            const bonusAmount = packages_1.DAILY_BONUS_CONFIG.amount;
            const newBalance = user.gold_balance + bonusAmount;
            // Update user
            await client.query(`UPDATE users
         SET gold_balance = $1,
             last_daily_bonus_claim = NOW(),
             total_gold_earned = total_gold_earned + $2,
             updated_at = NOW()
         WHERE user_id = $3`, [newBalance, bonusAmount, userId]);
            // Create transaction
            await client.query(`INSERT INTO gold_transactions
         (user_id, type, amount, balance_after, description)
         VALUES ($1, $2, $3, $4, $5)`, [userId, 'daily_bonus', bonusAmount, newBalance, packages_1.DAILY_BONUS_CONFIG.description]);
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
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Deduct gold (for match stakes, club creation, etc.)
     */
    async deductGold(userId, amount, type, description, relatedId) {
        const client = await connection_1.default.connect();
        try {
            await client.query('BEGIN');
            const userResult = await client.query('SELECT gold_balance FROM users WHERE user_id = $1 FOR UPDATE', [userId]);
            if (userResult.rows.length === 0) {
                throw new AppError_1.NotFoundError('User');
            }
            const currentBalance = userResult.rows[0].gold_balance;
            if (currentBalance < amount) {
                throw new AppError_1.ValidationError('Insufficient gold balance');
            }
            const newBalance = currentBalance - amount;
            await client.query(`UPDATE users
         SET gold_balance = $1,
             total_gold_spent = total_gold_spent + $2,
             updated_at = NOW()
         WHERE user_id = $3`, [newBalance, amount, userId]);
            await client.query(`INSERT INTO gold_transactions
         (user_id, type, amount, balance_after, description, related_match_id, related_club_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                userId,
                type,
                -amount,
                newBalance,
                description,
                relatedId?.match_id || null,
                relatedId?.club_id || null,
            ]);
            await client.query('COMMIT');
            return { new_balance: newBalance };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Add gold (for match wins, etc.)
     */
    async addGold(userId, amount, type, description, relatedId) {
        const client = await connection_1.default.connect();
        try {
            await client.query('BEGIN');
            const userResult = await client.query('SELECT gold_balance FROM users WHERE user_id = $1 FOR UPDATE', [userId]);
            if (userResult.rows.length === 0) {
                throw new AppError_1.NotFoundError('User');
            }
            const newBalance = userResult.rows[0].gold_balance + amount;
            await client.query(`UPDATE users
         SET gold_balance = $1,
             total_gold_earned = total_gold_earned + $2,
             updated_at = NOW()
         WHERE user_id = $3`, [newBalance, amount, userId]);
            await client.query(`INSERT INTO gold_transactions
         (user_id, type, amount, balance_after, description, related_match_id, related_club_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                userId,
                type,
                amount,
                newBalance,
                description,
                relatedId?.match_id || null,
                relatedId?.club_id || null,
            ]);
            await client.query('COMMIT');
            return { new_balance: newBalance };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
}
exports.GoldService = GoldService;
exports.goldService = new GoldService();
