"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const users_repository_1 = require("../repositories/users.repository");
const gold_repository_1 = require("../repositories/gold.repository");
const password_utils_1 = require("../utils/password.utils");
const jwt_utils_1 = require("../utils/jwt.utils");
const AppError_1 = require("../errors/AppError");
class AuthService {
    async register(data) {
        // Validate age confirmation
        if (!data.age_confirmed) {
            throw new AppError_1.ValidationError('Age confirmation is required');
        }
        // Check email
        const existingEmail = await users_repository_1.usersRepository.findByEmail(data.email);
        if (existingEmail) {
            throw new AppError_1.ValidationError('Email already registered');
        }
        // Check username
        const existingUsername = await users_repository_1.usersRepository.findByUsername(data.username);
        if (existingUsername) {
            throw new AppError_1.ValidationError('Username already taken');
        }
        // Hash password
        const passwordHash = await (0, password_utils_1.hashPassword)(data.password);
        // Create user
        const user = await users_repository_1.usersRepository.create({
            email: data.email,
            username: data.username,
            password_hash: passwordHash,
            avatar_url: data.avatar_url,
            country: data.country,
        });
        // Create welcome bonus transaction
        await gold_repository_1.goldRepository.createTransaction({
            user_id: user.user_id,
            type: 'welcome_bonus',
            amount: 10000,
            balance_after: 10000,
            description: 'Welcome bonus for new account',
        });
        // Generate tokens
        const tokens = this.generateTokens(user);
        await this.storeRefreshToken(user.user_id, tokens.refresh_token);
        // Return user without password
        const { password_hash, ...safeUser } = user;
        return { user: safeUser, tokens };
    }
    async login(credentials) {
        const user = await users_repository_1.usersRepository.findByEmail(credentials.email);
        if (!user || !user.password_hash) {
            throw new AppError_1.AuthenticationError('Invalid email or password');
        }
        const isPasswordValid = await (0, password_utils_1.verifyPassword)(credentials.password, user.password_hash);
        if (!isPasswordValid) {
            throw new AppError_1.AuthenticationError('Invalid email or password');
        }
        if (!user.is_active) {
            throw new AppError_1.AuthenticationError('Account is deactivated');
        }
        if (user.is_banned) {
            throw new AppError_1.AuthenticationError('Account is banned');
        }
        await users_repository_1.usersRepository.updateLastLogin(user.user_id);
        const tokens = this.generateTokens(user);
        await this.storeRefreshToken(user.user_id, tokens.refresh_token);
        const { password_hash, ...safeUser } = user;
        return { user: safeUser, tokens };
    }
    async refreshAccessToken(refreshToken) {
        try {
            const decoded = (0, jwt_utils_1.verifyRefreshToken)(refreshToken);
            const isValid = await this.verifyStoredRefreshToken(decoded.userId, refreshToken);
            if (!isValid) {
                throw new AppError_1.AuthenticationError('Invalid refresh token');
            }
            const user = await users_repository_1.usersRepository.findById(decoded.userId);
            if (!user || !user.is_active) {
                throw new AppError_1.AuthenticationError('User not found or inactive');
            }
            const tokens = this.generateTokens(user);
            await this.storeRefreshToken(user.user_id, tokens.refresh_token);
            return tokens;
        }
        catch (error) {
            throw new AppError_1.AuthenticationError('Invalid or expired refresh token');
        }
    }
    async logout(userId) {
        await users_repository_1.usersRepository.revokeAllRefreshTokens(userId);
    }
    async getProfile(userId) {
        const user = await users_repository_1.usersRepository.findById(userId);
        if (!user) {
            throw new AppError_1.AuthenticationError('User not found');
        }
        const { password_hash, ...safeUser } = user;
        return safeUser;
    }
    generateTokens(user) {
        return {
            access_token: (0, jwt_utils_1.generateAccessToken)({ userId: user.user_id, email: user.email }),
            refresh_token: (0, jwt_utils_1.generateRefreshToken)(user.user_id),
        };
    }
    async storeRefreshToken(userId, token) {
        const tokenHash = await (0, password_utils_1.hashPassword)(token);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await users_repository_1.usersRepository.storeRefreshToken(userId, tokenHash, expiresAt);
    }
    async verifyStoredRefreshToken(userId, token) {
        const storedTokens = await users_repository_1.usersRepository.getRefreshTokens(userId);
        for (const storedToken of storedTokens) {
            const isMatch = await (0, password_utils_1.verifyPassword)(token, storedToken.token_hash);
            if (isMatch)
                return true;
        }
        return false;
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
