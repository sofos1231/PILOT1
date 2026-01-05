import crypto from 'crypto';

export const randomUtils = {
  /**
   * Generate cryptographically secure random integer between min and max (inclusive)
   */
  randomInt(min: number, max: number): number {
    return crypto.randomInt(min, max + 1);
  },

  /**
   * Roll a single die (1-6)
   */
  rollDie(): number {
    return this.randomInt(1, 6);
  },
};
