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
    constructor(expenseService: ExpenseService, authService: AuthService);
    /** Get formatted settlement plan with display names */
    getSettlementPlan(groupId: string, members: Set<string>): {
        from: string;
        to: string;
        amount: string;
    }[];
    /** Get formatted balances with display names */
    getFormattedBalances(groupId: string, members: Set<string>): {
        name: string;
        email: string;
        balanceCents: number;
        display: string;
    }[];
}
