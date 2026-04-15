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
    constructor();
    register(email: string, password: string, name: string): {
        success: boolean;
        message: string;
    };
    login(email: string, password: string): {
        success: boolean;
        token?: string;
        name?: string;
        message: string;
    };
    getUser(email: string): UserAccount | undefined;
    getUserCount(): number;
}
