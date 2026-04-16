/**
 * @file ExpenseService.ts
 * @brief Service for expense tracking, balance computation, and settlement optimization.
 * @details Uses integer cent arithmetic to avoid floating-point precision issues.
 *          Settlement algorithm uses greedy matching to minimize transactions.
 * @author Jino Baby, Yashika
 * @version 1.0
 */

import { GroupService } from './GroupService';

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

export class ExpenseService {
    private expenses: ExpenseRecord[] = [];
    private nextId: number = 1;

    /**
     * Push a new expense row. amountCents should already be integer cents (caller rounds).
     * splitWith = who splits the bill (emails).
     */
    addExpense(groupId: string, payer: string, amountCents: number, description: string, splitWith: string[]): ExpenseRecord {
        const expense: ExpenseRecord = {
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
    getGroupExpenses(groupId: string): ExpenseRecord[] {
        return this.expenses.filter(e => e.groupId === groupId);
    }

    /**
     * Figure out who owes who net — uses cents to avoid float weirdness.
     * Credits payer with full amount, debits each splitter their share.
     * Remainder cents get distributed one cent at a time to first k people (floor division).
     */
    computeBalances(groupId: string, members: Set<string>): Map<string, number> {
        const balances = new Map<string, number>();

        // Net balance per email: positive => should receive money, negative => owes, 0 => even
        members.forEach(m => balances.set(m, 0));

        for (const e of this.expenses) {
            if (e.groupId !== groupId || e.splitWith.length === 0) continue;

            // Split total cents across splitWith; integer division leaves a remainder of 0..(n-1) cents
            const sharePerPerson = Math.floor(e.amountCents / e.splitWith.length);
            const remainder = e.amountCents - (sharePerPerson * e.splitWith.length);

            // Payer laid out the full cost upfront → their net should increase by that amount
            balances.set(e.payer, (balances.get(e.payer) || 0) + e.amountCents);

            // Each person in splitWith owes their share; give the extra remainder cents to the first `remainder` people (index order)
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
    computeSettlements(groupId: string, members: Set<string>): Settlement[] {
        const balances = this.computeBalances(groupId, members);

        // Owes money (balance < 0) vs should receive (balance > 0); use positive magnitudes only below
        const debtors: { email: string; amount: number }[] = [];
        const creditors: { email: string; amount: number }[] = [];

        balances.forEach((balance, email) => {
            if (balance < 0) debtors.push({ email, amount: -balance });
            else if (balance > 0) creditors.push({ email, amount: balance });
        });

        // Match largest obligations first (greedy heuristic)
        debtors.sort((a, b) => b.amount - a.amount);
        creditors.sort((a, b) => b.amount - a.amount);

        const settlements: Settlement[] = [];
        let di = 0, ci = 0;

        // Pair current biggest debtor with current biggest creditor; transfer min of the two remaining amounts, then advance pointers when one side is settled
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
            if (debtors[di].amount === 0) di++;
            if (creditors[ci].amount === 0) ci++;
        }

        return settlements;
    }

    /** Total expense rows stored — admin stats */
    getExpenseCount(): number {
        return this.expenses.length;
    }
}
