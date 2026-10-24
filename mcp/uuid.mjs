// Web-standard UUID (works in Node and the Convex runtime).
export const randomUUID = () => globalThis.crypto.randomUUID();
