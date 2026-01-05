import pool from '../db/connection';
import { usersRepository } from '../repositories/users.repository';
import { goldRepository } from '../repositories/gold.repository';
import { hashPassword, verifyPassword } from '../utils/password.utils';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.utils';
import { User, LoginCredentials, RegisterData, SafeUser } from '../types/user.types';
import { ValidationError, AuthenticationError } from '../errors/AppError';

interface Tokens {
  access_token: string;
  refresh_token: string;
}

export class AuthService {
  async register(data: RegisterData): Promise<{ user: SafeUser; tokens: Tokens }> {
    // Validate age confirmation
    if (!data.age_confirmed) {
      throw new ValidationError('Age confirmation is required');
    }

    // Check email
    const existingEmail = await usersRepository.findByEmail(data.email);
    if (existingEmail) {
      throw new ValidationError('Email already registered');
    }

    // Check username
    const existingUsername = await usersRepository.findByUsername(data.username);
    if (existingUsername) {
      throw new ValidationError('Username already taken');
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Create user
    const user = await usersRepository.create({
      email: data.email,
      username: data.username,
      password_hash: passwordHash,
      avatar_url: data.avatar_url,
      country: data.country,
    });

    // Create welcome bonus transaction
    await goldRepository.createTransaction({
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
    return { user: safeUser as SafeUser, tokens };
  }

  async login(credentials: LoginCredentials): Promise<{ user: SafeUser; tokens: Tokens }> {
    const user = await usersRepository.findByEmail(credentials.email);

    if (!user || !user.password_hash) {
      throw new AuthenticationError('Invalid email or password');
    }

    const isPasswordValid = await verifyPassword(credentials.password, user.password_hash);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    if (!user.is_active) {
      throw new AuthenticationError('Account is deactivated');
    }

    if (user.is_banned) {
      throw new AuthenticationError('Account is banned');
    }

    await usersRepository.updateLastLogin(user.user_id);

    const tokens = this.generateTokens(user);
    await this.storeRefreshToken(user.user_id, tokens.refresh_token);

    const { password_hash, ...safeUser } = user;
    return { user: safeUser as SafeUser, tokens };
  }

  async refreshAccessToken(refreshToken: string): Promise<Tokens> {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const isValid = await this.verifyStoredRefreshToken(decoded.userId, refreshToken);

      if (!isValid) {
        throw new AuthenticationError('Invalid refresh token');
      }

      const user = await usersRepository.findById(decoded.userId);
      if (!user || !user.is_active) {
        throw new AuthenticationError('User not found or inactive');
      }

      const tokens = this.generateTokens(user);
      await this.storeRefreshToken(user.user_id, tokens.refresh_token);

      return tokens;
    } catch (error) {
      throw new AuthenticationError('Invalid or expired refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    await usersRepository.revokeAllRefreshTokens(userId);
  }

  async getProfile(userId: string): Promise<SafeUser> {
    const user = await usersRepository.findById(userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    const { password_hash, ...safeUser } = user;
    return safeUser as SafeUser;
  }

  private generateTokens(user: User): Tokens {
    return {
      access_token: generateAccessToken({ userId: user.user_id, email: user.email }),
      refresh_token: generateRefreshToken(user.user_id),
    };
  }

  private async storeRefreshToken(userId: string, token: string): Promise<void> {
    const tokenHash = await hashPassword(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await usersRepository.storeRefreshToken(userId, tokenHash, expiresAt);
  }

  private async verifyStoredRefreshToken(userId: string, token: string): Promise<boolean> {
    const storedTokens = await usersRepository.getRefreshTokens(userId);
    for (const storedToken of storedTokens) {
      const isMatch = await verifyPassword(token, storedToken.token_hash);
      if (isMatch) return true;
    }
    return false;
  }
}

export const authService = new AuthService();
