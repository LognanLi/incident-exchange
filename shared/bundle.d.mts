export declare const SCHEMA_VERSION: "1";
export declare const CONTENT_FIELDS: string[];
export declare const LIMITS: { field: number; list: number; listItem: number };
export declare function canonicalBundle(bundle: Record<string, unknown>): string;
export declare function sha256Hex(text: string): Promise<string>;
export declare function bundleHash(bundle: Record<string, unknown>): Promise<string>;
export declare function scanSecrets(text: string, extraTerms?: string[]): string[];
export declare function scanInjection(text: string): string[];
export declare function bundleText(bundle: Record<string, unknown>): string;
