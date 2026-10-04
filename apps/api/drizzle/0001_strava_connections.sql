CREATE TABLE "strava_connections" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"athlete_id" text NOT NULL,
	"athlete_name" text,
	"scope" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"cursor" bigint NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sync_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "strava_connections" ADD CONSTRAINT "strava_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;