export declare function buildServer(opts: {
  token: string;
  svc: string;
  exec: (kind: "query" | "mutation" | "action", fn: any, args: any) => Promise<any>;
  semanticCandidates?: (text: string) => Promise<{ candidates: { id: string; score: number }[]; latencyMs: number } | null>;
  retrievalStatus?: () => { ready: boolean; error: string | null };
  deployment: "local" | "remote";
}): import("@modelcontextprotocol/sdk/server/mcp.js").McpServer;
export declare function envelope(status: string, data?: unknown, error?: unknown, mode?: string): object;
