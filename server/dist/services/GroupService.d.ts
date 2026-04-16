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
    /**
     * Makes a new group, creator is auto-added to members set.
     * Id is grp_1, grp_2, ... incrementing.
     */
    createGroup(name: string, creatorEmail: string): ExpenseGroup;
    /**
     * Add user email to group if group exists. Doesnt check duplicates (Set handles it).
     */
    joinGroup(groupId: string, email: string): {
        success: boolean;
        group?: ExpenseGroup;
        message: string;
    };
    /** Simple map get */
    getGroup(groupId: string): ExpenseGroup | undefined;
    /**
     * All groups where this email is in the members set.
     */
    getUserGroups(email: string): ExpenseGroup[];
    /**
     * True if user is in that group. False if group doesnt exist.
     */
    isMember(groupId: string, email: string): boolean;
    /**
     * Remove user from the group permanently (they must join again to return).
     * Deletes the group if nobody is left.
     */
    quitGroup(groupId: string, email: string): {
        success: boolean;
        message: string;
    };
    /** For admin dashboard — total groups */
    getGroupCount(): number;
}
