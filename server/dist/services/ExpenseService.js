"use strict";
/**
 * @file ExpenseService.ts
 * @brief Service for expense tracking, balance computation, and settlement optimization.
 * @details Uses integer cent arithmetic to avoid floating-point precision issues.
 *          Settlement algorithm uses greedy matching to minimize transactions.
 * @author Jino Baby, Yashika
 * @version 1.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpenseService = void 0;
class ExpenseService {
    constructor() {
        this.expenses = [];
        this.nextId = 1;
    }
    /**
     * Push a new expense row. amountCents should already be integer cents (caller rounds).
     * splitWith = who splits the bill (emails).
     */
    addExpense(groupId, payer, amountCents, description, splitWith) {
        const expense = {
            id: this.nextId++,
            groupId,
            payer,
            amountCents,
            description,
            splitWith,
            receiptFile: '',
        };
        this.expenses.push(expense);
        return expense;
    }
    /** Filter expenses for one group id */
    getGroupExpenses(groupId) {
        return this.expenses.filter(e => e.groupId === groupId);
    }
    /**
     * Figure out who owes who net — uses cents to avoid float weirdness.
     * Credits payer with full amount, debits each splitter their share.
     * Remainder cents get distributed one cent at a time to first k people (floor division).
     */
    computeBalances(groupId, members) {
        const balances = new Map();
        // Initialize all members to 0
        members.forEach(m => balances.set(m, 0));
        // Process each expense
        for (const e of this.expenses) {
            if (e.groupId !== groupId || e.splitWith.length === 0)
                continue;
            const sharePerPerson = Math.floor(e.amountCents / e.splitWith.length);
            const remainder = e.amountCents - (sharePerPerson * e.splitWith.length);
            // Credit the payer
            balances.set(e.payer, (balances.get(e.payer) || 0) + e.amountCents);
            // Debit each participant
            e.splitWith.forEach((member, i) => {
                const share = sharePerPerson + (i < remainder ? 1 : 0);
                balances.set(member, (balances.get(member) || 0) - share);
            });
        }
        return balances;
    }
    /**
     * After balances, try to minimize number of transfers using greedy match
     * (biggest debtor pays biggest creditor etc). Not guaranteed optimal but ok for class project.
     */
    computeSettlements(groupId, members) {
        const balances = this.computeBalances(groupId, members);
        // Separate into debtors and creditors
        const debtors = [];
        const creditors = [];
        balances.forEach((balance, email) => {
            if (balance < 0)
                debtors.push({ email, amount: -balance });
            else if (balance > 0)
                creditors.push({ email, amount: balance });
        });
        // Sort descending by amount
        debtors.sort((a, b) => b.amount - a.amount);
        creditors.sort((a, b) => b.amount - a.amount);
        // Greedy matching
        const settlements = [];
        let di = 0, ci = 0;
        while (di < debtors.length && ci < creditors.length) {
            const amount = Math.min(debtors[di].amount, creditors[ci].amount);
            if (amount > 0) {
                settlements.push({
                    from: debtors[di].email,
                    to: creditors[ci].email,
                    amountCents: amount,
                });
            }
            debtors[di].amount -= amount;
            creditors[ci].amount -= amount;
            if (debtors[di].amount === 0)
                di++;
            if (creditors[ci].amount === 0)
                ci++;
        }
        return settlements;
    }
    /** Total expense rows stored — admin stats */
    getExpenseCount() {
        return this.expenses.length;
    }
}
exports.ExpenseService = ExpenseService;
