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
    /**
     * Push a new expense row. amountCents should already be integer cents (caller rounds).
     * splitWith = who splits the bill (emails).
     */
    addExpense(groupId: string, payer: string, amountCents: number, description: string, splitWith: string[]): ExpenseRecord;
    /** Filter expenses for one group id */
    getGroupExpenses(groupId: string): ExpenseRecord[];
    /**
     * Figure out who owes who net — uses cents to avoid float weirdness.
     * Credits payer with full amount, debits each splitter their share.
     * Remainder cents get distributed one cent at a time to first k people (floor division).
     */
    computeBalances(groupId: string, members: Set<string>): Map<string, number>;
    /**
     * After balances, try to minimize number of transfers using greedy match
     * (biggest debtor pays biggest creditor etc). Not guaranteed optimal but ok for class project.
     */
    computeSettlements(groupId: string, members: Set<string>): Settlement[];
    /** Total expense rows stored — admin stats */
    getExpenseCount(): number;
}
