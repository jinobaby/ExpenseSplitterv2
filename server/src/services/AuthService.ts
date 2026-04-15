/**
 * @file AuthService.ts
 * @brief Authentication service for user registration and login (REQ-SYS-080).
 * @author Jino Baby, Yashika
 * @version 1.0
 */

export interface UserAccount {
    email: string;
    password: string;
    name: string;
}

export class AuthService {
    private users: Map<string, UserAccount> = new Map();

    constructor() {
        // Pre-populate demo users
        this.users.set('jino@test.com', { email: 'jino@test.com', password: 'pass123', name: 'Jino' });
        this.users.set('yashika@test.com', { email: 'yashika@test.com', password: 'pass123', name: 'Yashika' });
        this.users.set('alice@test.com', { email: 'alice@test.com', password: 'pass123', name: 'Alice' });
        this.users.set('bob@test.com', { email: 'bob@test.com', password: 'pass123', name: 'Bob' });
    }

    register(email: string, password: string, name: string): { success: boolean; message: string } {
        if (!email || !password || !name) {
            return { success: false, message: 'Missing email, password, or name' };
        }
        if (this.users.has(email)) {
            return { success: false, message: 'Email already registered' };
        }
        this.users.set(email, { email, password, name });
        return { success: true, message: 'Registration successful' };
    }

    login(email: string, password: string): { success: boolean; token?: string; name?: string; message: string } {
        const user = this.users.get(email);
        if (!user || user.password !== password) {
            return { success: false, message: 'Invalid email or password' };
        }
        const token = `tok_${email}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
        return { success: true, token, name: user.name, message: 'Login successful' };
    }

    getUser(email: string): UserAccount | undefined {
        return this.users.get(email);
    }

    getUserCount(): number {
        return this.users.size;
    }
}
