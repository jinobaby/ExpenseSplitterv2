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

    /**
     * Makes a new group, creator is auto-added to members set.
     * Id is grp_1, grp_2, ... incrementing.
     */
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

    /**
     * Add user email to group if group exists. Doesnt check duplicates (Set handles it).
     */
    joinGroup(groupId: string, email: string): { success: boolean; group?: ExpenseGroup; message: string } {
        const group = this.groups.get(groupId);
        if (!group) return { success: false, message: 'Group not found' };
        group.members.add(email);
        return { success: true, group, message: 'Joined group' };
    }

    /** Simple map get */
    getGroup(groupId: string): ExpenseGroup | undefined {
        return this.groups.get(groupId);
    }

    /**
     * All groups where this email is in the members set.
     */
    getUserGroups(email: string): ExpenseGroup[] {
        return Array.from(this.groups.values()).filter(g => g.members.has(email));
    }

    /**
     * True if user is in that group. False if group doesnt exist.
     */
    isMember(groupId: string, email: string): boolean {
        const group = this.groups.get(groupId);
        return group ? group.members.has(email) : false;
    }

    /**
     * Remove user from the group permanently (they must join again to return).
     * Deletes the group if nobody is left.
     */
    quitGroup(groupId: string, email: string): { success: boolean; message: string } {
        const group = this.groups.get(groupId);
        if (!group) return { success: false, message: 'Group not found' };
        if (!group.members.has(email)) return { success: false, message: 'Not a member of this group' };
        group.members.delete(email);
        if (group.members.size === 0) {
            this.groups.delete(groupId);
        }
        return { success: true, message: 'You left the group' };
    }

    /** For admin dashboard — total groups */
    getGroupCount(): number {
        return this.groups.size;
    }
}
