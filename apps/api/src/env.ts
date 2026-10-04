import type { LoginLimiter } from "./auth/rateLimit";
import type { SessionUser } from "./auth/session";
import type { Db } from "./db/client";
import type { StravaConfig } from "./strava";

export interface AppContext {
  db: Db;
  limiter: LoginLimiter;
  /** Secure cookies in production (HTTPS behind Traefik); off for http://localhost development. */
  secureCookies: boolean;
  /** Origins allowed to send state-changing requests (CSRF guard). Empty = allow any (development/tests). */
  allowedOrigins: string[];
  /** Strava API app (docs/adr/0009-strava.md); null/undefined = not set up, the Profile card says so. */
  strava?: StravaConfig | null;
  /** fetch for the Open Food Facts proxy (tests pass a fake); default global fetch. */
  foodFetch?: (url: string, init?: RequestInit) => Promise<Response>;
}

export interface AppEnv {
  Variables: {
    ctx: AppContext;
    user: SessionUser | null;
    clientIp: string;
  };
}
