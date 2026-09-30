/**
 * Login brute-force protection: 5 failed attempts per username + IP within 15 minutes
 * block that combination for 15 minutes. In memory (one app container).
 */
const WINDOW = 15 * 60_000;
const MAX_FAILS = 5;

interface Entry { fails: number; firstAt: number; blockedUntil: number }

export class LoginLimiter {
  private entries = new Map<string, Entry>();
  constructor(private now: () => number = Date.now) {}

  private key(ip: string, username: string) { return `${ip}|${username.toLowerCase()}`; }

  isBlocked(ip: string, username: string): boolean {
    const e = this.entries.get(this.key(ip, username));
    return !!e && e.blockedUntil > this.now();
  }

  fail(ip: string, username: string): void {
    const k = this.key(ip, username), t = this.now();
    const e = this.entries.get(k);
    if (!e || t - e.firstAt > WINDOW) { this.entries.set(k, { fails: 1, firstAt: t, blockedUntil: 0 }); return; }
    e.fails++;
    if (e.fails >= MAX_FAILS) e.blockedUntil = t + WINDOW;
    if (this.entries.size > 10_000) this.prune();
  }

  success(ip: string, username: string): void {
    this.entries.delete(this.key(ip, username));
  }

  private prune() {
    const t = this.now();
    for (const [k, e] of this.entries) if (e.blockedUntil < t && t - e.firstAt > WINDOW) this.entries.delete(k);
  }
}
