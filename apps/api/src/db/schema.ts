import { bigint, index, jsonb, pgSequence, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Accounts. There is no sign-up: the admin creates users (docs/adr/0005-backend-auth-and-sync.md). */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull(),
  usernameLower: text("username_lower").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
});

/** Login sessions. `id` is the SHA-256 hash of the cookie token; the token itself is never stored. */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  userAgent: text("user_agent"),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

/** Global, ever-increasing version for sync pulls. */
export const syncVersion = pgSequence("sync_version");

/**
 * Every synced client row, one generic table (ADR 0005). `data` is the row as the client knows it,
 * validated with the shared Zod schema of its table. Conflicts: last-write-wins on `updated_at`.
 */
export const records = pgTable("records", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tableName: text("table_name").notNull(),
  id: text("id").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  serverVersion: bigint("server_version", { mode: "number" }).notNull(),
  data: jsonb("data").notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.tableName, t.id] }),
  index("records_user_version_idx").on(t.userId, t.serverVersion),
]);

/**
 * Strava connection per user (docs/adr/0009-strava.md). Tokens are encrypted with AES-256-GCM
 * (STRAVA_TOKEN_KEY); the database never holds them in plain text. Deleting the user removes the row.
 */
export const stravaConnections = pgTable("strava_connections", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  athleteId: text("athlete_id").notNull(),
  athleteName: text("athlete_name"),
  scope: text("scope").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  /** Unix seconds: the next import asks Strava for runs that started after this. */
  cursor: bigint("cursor", { mode: "number" }).notNull(),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
});
