import type { LoginLimiter } from "./auth/rateLimit";
import type { SessionUser } from "./auth/session";
import type { Db } from "./db/client";

export interface AppContext {
  db: Db;
  limiter: LoginLimiter;
  /** Secure cookies in production (HTTPS behind Traefik); off for http://localhost development. */
  secureCookies: boolean;
  /** Origins allowed to send state-changing requests (CSRF guard). Empty = allow any (development/tests). */
  allowedOrigins: string[];
}

export interface AppEnv {
  Variables: {
    ctx: AppContext;
    user: SessionUser | null;
    clientIp: string;
  };
}
