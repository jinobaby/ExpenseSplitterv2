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
export declare class GroupService {
    private groups;
    private nextId;
    createGroup(name: string, creatorEmail: string): ExpenseGroup;
    joinGroup(groupId: string, email: string): {
        success: boolean;
        group?: ExpenseGroup;
        message: string;
    };
    getGroup(groupId: string): ExpenseGroup | undefined;
    getUserGroups(email: string): ExpenseGroup[];
    isMember(groupId: string, email: string): boolean;
    getGroupCount(): number;
}
