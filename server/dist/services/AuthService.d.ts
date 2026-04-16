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
export declare class AuthService {
    private users;
    /**
     * In-memory user store. Seeds a few demo accounts for testing the assignment.
     */
    constructor();
    /**
     * Register new user. Fails if missing fields or email already exists.
     * Password is stored plain text rn (not secure, just for the project demo).
     */
    register(email: string, password: string, name: string): {
        success: boolean;
        message: string;
    };
    /**
     * Check email/password and if ok return a fake token string + display name.
     * Token is basically random-ish string, not a real JWT or anything.
     */
    login(email: string, password: string): {
        success: boolean;
        token?: string;
        name?: string;
        message: string;
    };
    /**
     * Lookup user by email for showing names in groups / expenses.
     */
    getUser(email: string): UserAccount | undefined;
    /** How many users in the map — used by admin status */
    getUserCount(): number;
}
