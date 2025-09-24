// Minimal Node ambient types to satisfy editor when @types/node isn't installed
declare namespace NodeJS { interface Process { env: Record<string, string | undefined>; } }
declare var process: NodeJS.Process;
declare module 'node:fs/promises' { export * from 'fs/promises'; }
declare module 'node:url' { export * from 'url'; }
