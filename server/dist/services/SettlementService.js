"use strict";
/**
 * @file SettlementService.ts
 * @brief Service wrapper for settlement computation and formatting.
 * @details Provides formatted settlement output using the ExpenseService
 *          greedy algorithm. Matches the service architecture from the proposal.
 * @author Jino Baby, Yashika
 * @version 1.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementService = void 0;
class SettlementService {
    /**
     * Needs expense math + auth for resolving emails to display names.
     */
    constructor(expenseService, authService) {
        this.expenseService = expenseService;
        this.authService = authService;
    }
    /**
     * Returns who should pay who as strings like "$12.34" with real names if we have them.
     * Wraps computeSettlements from ExpenseService.
     */
    getSettlementPlan(groupId, members) {
        const settlements = this.expenseService.computeSettlements(groupId, members);
        return settlements.map(s => {
            const fromUser = this.authService.getUser(s.from);
            const toUser = this.authService.getUser(s.to);
            const dollars = Math.floor(s.amountCents / 100);
            const cents = s.amountCents % 100;
            return {
                from: fromUser?.name || s.from,
                to: toUser?.name || s.to,
                amount: `$${dollars}.${cents < 10 ? '0' : ''}${cents}`,
            };
        });
    }
    /**
     * Per-person balance with a human readable display string (owes / is owed / settled).
     */
    getFormattedBalances(groupId, members) {
        const balances = this.expenseService.computeBalances(groupId, members);
        const result = [];
        balances.forEach((cents, email) => {
            const user = this.authService.getUser(email);
            const absCents = Math.abs(cents);
            const dollars = Math.floor(absCents / 100);
            const remainder = absCents % 100;
            const sign = cents >= 0 ? '+' : '-';
            const label = cents > 0 ? 'is owed' : cents < 0 ? 'owes' : 'settled';
            result.push({
                name: user?.name || email,
                email,
                balanceCents: cents,
                display: `${sign}$${dollars}.${remainder < 10 ? '0' : ''}${remainder} (${label})`,
            });
        });
        return result;
    }
}
exports.SettlementService = SettlementService;
