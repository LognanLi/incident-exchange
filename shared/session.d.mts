export declare function mintSession(secret: string, slug: string, ttlMs?: number): Promise<string>;
export declare function verifySession(secret: string | undefined, token: string): Promise<string | null>;
