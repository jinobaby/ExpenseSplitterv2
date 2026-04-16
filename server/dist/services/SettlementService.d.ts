/**
 * @file SettlementService.ts
 * @brief Service wrapper for settlement computation and formatting.
 * @details Provides formatted settlement output using the ExpenseService
 *          greedy algorithm. Matches the service architecture from the proposal.
 * @author Jino Baby, Yashika
 * @version 1.0
 */
import { ExpenseService } from './ExpenseService';
import { AuthService } from './AuthService';
export declare class SettlementService {
    private expenseService;
    private authService;
    /**
     * Needs expense math + auth for resolving emails to display names.
     */
    constructor(expenseService: ExpenseService, authService: AuthService);
    /**
     * Returns who should pay who as strings like "$12.34" with real names if we have them.
     * Wraps computeSettlements from ExpenseService.
     */
    getSettlementPlan(groupId: string, members: Set<string>): {
        from: string;
        to: string;
        amount: string;
    }[];
    /**
     * Per-person balance with a human readable display string (owes / is owed / settled).
     */
    getFormattedBalances(groupId: string, members: Set<string>): {
        name: string;
        email: string;
        balanceCents: number;
        display: string;
    }[];
}
