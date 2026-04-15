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

    getGroupExpenses(groupId: string): ExpenseRecord[] {
        return this.expenses.filter(e => e.groupId === groupId);
    }

    /** Compute net balances for each group member (in cents) */
    computeBalances(groupId: string, members: Set<string>): Map<string, number> {
        const balances = new Map<string, number>();

        // Initialize all members to 0
        members.forEach(m => balances.set(m, 0));

        // Process each expense
        for (const e of this.expenses) {
            if (e.groupId !== groupId || e.splitWith.length === 0) continue;

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

    /** Compute simplified settlement plan using greedy matching algorithm */
    computeSettlements(groupId: string, members: Set<string>): Settlement[] {
        const balances = this.computeBalances(groupId, members);

        // Separate into debtors and creditors
        const debtors: { email: string; amount: number }[] = [];
        const creditors: { email: string; amount: number }[] = [];

        balances.forEach((balance, email) => {
            if (balance < 0) debtors.push({ email, amount: -balance });
            else if (balance > 0) creditors.push({ email, amount: balance });
        });

        // Sort descending by amount
        debtors.sort((a, b) => b.amount - a.amount);
        creditors.sort((a, b) => b.amount - a.amount);

        // Greedy matching
        const settlements: Settlement[] = [];
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
            if (debtors[di].amount === 0) di++;
            if (creditors[ci].amount === 0) ci++;
        }

        return settlements;
    }

    getExpenseCount(): number {
        return this.expenses.length;
    }
}
