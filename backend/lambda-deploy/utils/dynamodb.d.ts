import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { User } from '../types/auth';
export declare const dynamodb: DynamoDBDocumentClient;
export declare const userService: {
    createUser(user: Omit<User, "pk" | "sk">): Promise<User>;
    getUser(userId: string): Promise<User | null>;
    getUserByEmail(email: string): Promise<User | null>;
    updateUser(userId: string, updates: Partial<User>): Promise<User>;
    updateLastLogin(userId: string): Promise<User>;
};
//# sourceMappingURL=dynamodb.d.ts.map