export declare function mintSession(secret: string, slug: string, ttlMs?: number, kind?: "operator" | "viewer"): Promise<string>;
export declare function verifySessionInfo(secret: string | undefined, token: string): Promise<{ slug: string; operator: boolean } | null>;
export declare function verifySession(secret: string | undefined, token: string): Promise<string | null>;
