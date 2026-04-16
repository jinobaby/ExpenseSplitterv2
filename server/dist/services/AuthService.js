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
    /**
     * In-memory user store. Seeds a few demo accounts for testing the assignment.
     */
    constructor() {
        this.users = new Map();
        // Pre-populate demo users
        this.users.set('jino@test.com', { email: 'jino@test.com', password: 'pass123', name: 'Jino' });
        this.users.set('yashika@test.com', { email: 'yashika@test.com', password: 'pass123', name: 'Yashika' });
        this.users.set('alice@test.com', { email: 'alice@test.com', password: 'pass123', name: 'Alice' });
        this.users.set('bob@test.com', { email: 'bob@test.com', password: 'pass123', name: 'Bob' });
    }
    /**
     * Register new user. Fails if missing fields or email already exists.
     * Password is stored plain text rn (not secure, just for the project demo).
     */
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
    /**
     * Check email/password and if ok return a fake token string + display name.
     * Token is basically random-ish string, not a real JWT or anything.
     */
    login(email, password) {
        const user = this.users.get(email);
        if (!user || user.password !== password) {
            return { success: false, message: 'Invalid email or password' };
        }
        const token = `tok_${email}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
        return { success: true, token, name: user.name, message: 'Login successful' };
    }
    /**
     * Lookup user by email for showing names in groups / expenses.
     */
    getUser(email) {
        return this.users.get(email);
    }
    /** How many users in the map — used by admin status */
    getUserCount() {
        return this.users.size;
    }
}
exports.AuthService = AuthService;
