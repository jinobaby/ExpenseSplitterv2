"use strict";
/**
 * @file GroupService.ts
 * @brief Service for managing expense groups.
 * @author Jino Baby, Yashika
 * @version 1.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupService = void 0;
class GroupService {
    constructor() {
        this.groups = new Map();
        this.nextId = 1;
    }
    createGroup(name, creatorEmail) {
        const id = `grp_${this.nextId++}`;
        const group = {
            id,
            name,
            creator: creatorEmail,
            members: new Set([creatorEmail]),
        };
        this.groups.set(id, group);
        return group;
    }
    joinGroup(groupId, email) {
        const group = this.groups.get(groupId);
        if (!group)
            return { success: false, message: 'Group not found' };
        group.members.add(email);
        return { success: true, group, message: 'Joined group' };
    }
    getGroup(groupId) {
        return this.groups.get(groupId);
    }
    getUserGroups(email) {
        return Array.from(this.groups.values()).filter(g => g.members.has(email));
    }
    isMember(groupId, email) {
        const group = this.groups.get(groupId);
        return group ? group.members.has(email) : false;
    }
    getGroupCount() {
        return this.groups.size;
    }
}
exports.GroupService = GroupService;
