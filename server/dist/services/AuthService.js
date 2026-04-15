"use strict";
/**
 * @file AuthService.ts
 * @brief Authentication service for user registration and login (REQ-SYS-080).
 * @author Jino Baby, Yashika
 * @version 1.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
class AuthService {
    constructor() {
        this.users = new Map();
        // Pre-populate demo users
        this.users.set('jino@test.com', { email: 'jino@test.com', password: 'pass123', name: 'Jino' });
        this.users.set('yashika@test.com', { email: 'yashika@test.com', password: 'pass123', name: 'Yashika' });
        this.users.set('alice@test.com', { email: 'alice@test.com', password: 'pass123', name: 'Alice' });
        this.users.set('bob@test.com', { email: 'bob@test.com', password: 'pass123', name: 'Bob' });
    }
    register(email, password, name) {
        if (!email || !password || !name) {
            return { success: false, message: 'Missing email, password, or name' };
        }
        if (this.users.has(email)) {
            return { success: false, message: 'Email already registered' };
        }
        this.users.set(email, { email, password, name });
        return { success: true, message: 'Registration successful' };
    }
    login(email, password) {
        const user = this.users.get(email);
        if (!user || user.password !== password) {
            return { success: false, message: 'Invalid email or password' };
        }
        const token = `tok_${email}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
        return { success: true, token, name: user.name, message: 'Login successful' };
    }
    getUser(email) {
        return this.users.get(email);
    }
    getUserCount() {
        return this.users.size;
    }
}
exports.AuthService = AuthService;
