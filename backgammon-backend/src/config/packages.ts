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
