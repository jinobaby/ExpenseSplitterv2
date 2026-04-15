/**
 * @file GroupService.ts
 * @brief Service for managing expense groups.
 * @author Jino Baby, Yashika
 * @version 1.0
 */

export interface ExpenseGroup {
    id: string;
    name: string;
    creator: string;
    members: Set<string>;
}

export class GroupService {
    private groups: Map<string, ExpenseGroup> = new Map();
    private nextId: number = 1;

    createGroup(name: string, creatorEmail: string): ExpenseGroup {
        const id = `grp_${this.nextId++}`;
        const group: ExpenseGroup = {
            id,
            name,
            creator: creatorEmail,
            members: new Set([creatorEmail]),
        };
        this.groups.set(id, group);
        return group;
    }

    joinGroup(groupId: string, email: string): { success: boolean; group?: ExpenseGroup; message: string } {
        const group = this.groups.get(groupId);
        if (!group) return { success: false, message: 'Group not found' };
        group.members.add(email);
        return { success: true, group, message: 'Joined group' };
    }

    getGroup(groupId: string): ExpenseGroup | undefined {
        return this.groups.get(groupId);
    }

    getUserGroups(email: string): ExpenseGroup[] {
        return Array.from(this.groups.values()).filter(g => g.members.has(email));
    }

    isMember(groupId: string, email: string): boolean {
        const group = this.groups.get(groupId);
        return group ? group.members.has(email) : false;
    }

    getGroupCount(): number {
        return this.groups.size;
    }
}
