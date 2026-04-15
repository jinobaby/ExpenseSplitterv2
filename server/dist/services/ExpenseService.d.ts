/**
 * @file ExpenseService.ts
 * @brief Service for expense tracking, balance computation, and settlement optimization.
 * @details Uses integer cent arithmetic to avoid floating-point precision issues.
 *          Settlement algorithm uses greedy matching to minimize transactions.
 * @author Jino Baby, Yashika
 * @version 1.0
 */
export interface ExpenseRecord {
    id: number;
    groupId: string;
    payer: string;
    amountCents: number;
    description: string;
    splitWith: string[];
    receiptFile: string;
}
export interface Settlement {
    from: string;
    to: string;
    amountCents: number;
}
export declare class ExpenseService {
    private expenses;
    private nextId;
    addExpense(groupId: string, payer: string, amountCents: number, description: string, splitWith: string[]): ExpenseRecord;
    getGroupExpenses(groupId: string): ExpenseRecord[];
    /** Compute net balances for each group member (in cents) */
    computeBalances(groupId: string, members: Set<string>): Map<string, number>;
    /** Compute simplified settlement plan using greedy matching algorithm */
    computeSettlements(groupId: string, members: Set<string>): Settlement[];
    getExpenseCount(): number;
}
