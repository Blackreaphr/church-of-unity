// Ambient declarations for Cloudflare Turnstile loaded via script tag
// This satisfies TypeScript when checking JS files that reference window.turnstile

export {};

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: Record<string, any>
      ) => any;
      getResponse: (widget?: any) => string;
      reset?: (widget?: any) => void;
      remove?: (widget?: any) => void;
      ready?: (cb: () => void) => void;
    };
  }

  /** Optional global injected by Turnstile script */
  const turnstile: Window['turnstile'];
}

