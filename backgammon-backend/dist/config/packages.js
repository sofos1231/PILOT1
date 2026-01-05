"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAILY_BONUS_CONFIG = exports.GOLD_PACKAGES = void 0;
exports.getPackage = getPackage;
exports.getTotalGold = getTotalGold;
exports.GOLD_PACKAGES = [
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
function getPackage(packageId) {
    return exports.GOLD_PACKAGES.find(p => p.package_id === packageId);
}
function getTotalGold(pkg) {
    return pkg.gold_amount + pkg.bonus_gold;
}
// Daily bonus configuration
exports.DAILY_BONUS_CONFIG = {
    amount: 500,
    description: 'Daily login bonus',
};
