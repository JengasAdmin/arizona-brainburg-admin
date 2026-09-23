CREATE TABLE "servers" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_number" integer NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'Europe/Moscow' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "servers_server_number_unique" UNIQUE("server_number")
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"provider_username" text,
	"provider_display_name" text,
	"provider_avatar_url" text,
	"profile" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"nickname" text,
	"avatar_url" text,
	"game_id" text,
	"game_id_verified_at" timestamp with time zone,
	"game_id_verified_by" integer,
	"server_id" integer DEFAULT 5 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"status_reason" text,
	"branch" text,
	"registration_source" text DEFAULT 'discord' NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departments_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"group" text NOT NULL,
	"scoped" boolean DEFAULT true NOT NULL,
	"critical" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" integer NOT NULL,
	"permission_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_key_pk" PRIMARY KEY("role_id","permission_key")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"level" integer DEFAULT 0 NOT NULL,
	"category" text DEFAULT 'player' NOT NULL,
	"manages_admin_roles" boolean DEFAULT false NOT NULL,
	"department_id" integer,
	"is_system" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"assigned_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "faction_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faction_categories_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "faction_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"faction_id" integer NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'leader' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"max_active_terms" integer DEFAULT 1 NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faction_positions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "factions" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"description" text,
	"category_id" integer NOT NULL,
	"department_id" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"allow_multiple_leaders" boolean DEFAULT false NOT NULL,
	"allow_cross_faction_leadership" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "factions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "disciplinary_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"term_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"reason" text NOT NULL,
	"issued_by" integer,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leadership_points_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"term_id" integer NOT NULL,
	"old_value" integer NOT NULL,
	"new_value" integer NOT NULL,
	"difference" integer NOT NULL,
	"reason" text NOT NULL,
	"actor_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leadership_terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"term_number" integer NOT NULL,
	"user_id" integer NOT NULL,
	"faction_id" integer NOT NULL,
	"position_id" integer NOT NULL,
	"rank" integer DEFAULT 1 NOT NULL,
	"rank_label" text,
	"appointed_at" date DEFAULT now() NOT NULL,
	"appointment_reason" text NOT NULL,
	"appointed_by" integer,
	"dismissed_at" date,
	"dismissal_reason" text,
	"dismissed_by" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"leadership_points" integer DEFAULT 0 NOT NULL,
	"warnings_count" integer DEFAULT 0 NOT NULL,
	"reprimands_count" integer DEFAULT 0 NOT NULL,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"faction_id" integer NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_accounts_faction_id_unique" UNIQUE("faction_id")
);
--> statement-breakpoint
CREATE TABLE "budget_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"faction_id" integer NOT NULL,
	"amount" bigint NOT NULL,
	"type" text NOT NULL,
	"balance_before" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"reason" text NOT NULL,
	"actor_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_role" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"target_label" text,
	"old_value" jsonb,
	"new_value" jsonb,
	"reason" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"faction_id" integer,
	"action" text NOT NULL,
	"description" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "integration_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'game_bot' NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb,
	"status" text DEFAULT 'received' NOT NULL,
	"api_key_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"metadata" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_game_id_verified_by_users_id_fk" FOREIGN KEY ("game_id_verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE set default ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faction_positions" ADD CONSTRAINT "faction_positions_faction_id_factions_id_fk" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factions" ADD CONSTRAINT "factions_category_id_faction_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."faction_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factions" ADD CONSTRAINT "factions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disciplinary_actions" ADD CONSTRAINT "disciplinary_actions_term_id_leadership_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."leadership_terms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disciplinary_actions" ADD CONSTRAINT "disciplinary_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disciplinary_actions" ADD CONSTRAINT "disciplinary_actions_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leadership_points_history" ADD CONSTRAINT "leadership_points_history_term_id_leadership_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."leadership_terms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leadership_points_history" ADD CONSTRAINT "leadership_points_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leadership_terms" ADD CONSTRAINT "leadership_terms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leadership_terms" ADD CONSTRAINT "leadership_terms_faction_id_factions_id_fk" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leadership_terms" ADD CONSTRAINT "leadership_terms_position_id_faction_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."faction_positions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leadership_terms" ADD CONSTRAINT "leadership_terms_appointed_by_users_id_fk" FOREIGN KEY ("appointed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leadership_terms" ADD CONSTRAINT "leadership_terms_dismissed_by_users_id_fk" FOREIGN KEY ("dismissed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leadership_terms" ADD CONSTRAINT "leadership_terms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leadership_terms" ADD CONSTRAINT "leadership_terms_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_accounts" ADD CONSTRAINT "budget_accounts_faction_id_factions_id_fk" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_transactions" ADD CONSTRAINT "budget_transactions_account_id_budget_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."budget_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_transactions" ADD CONSTRAINT "budget_transactions_faction_id_factions_id_fk" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_transactions" ADD CONSTRAINT "budget_transactions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_activity" ADD CONSTRAINT "game_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_activity" ADD CONSTRAINT "game_activity_faction_id_factions_id_fk" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_activity" ADD CONSTRAINT "game_activity_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_api_keys" ADD CONSTRAINT "integration_api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_api_key_id_integration_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."integration_api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "servers_number_uq" ON "servers" USING btree ("server_number");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_accounts_provider_user_uq" ON "oauth_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_accounts_user_provider_uq" ON "oauth_accounts" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "oauth_accounts_user_idx" ON "oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_game_id_uq" ON "users" USING btree ("game_id","server_id");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_nickname_idx" ON "users" USING btree ("nickname");--> statement-breakpoint
CREATE INDEX "users_display_name_idx" ON "users" USING btree ("display_name");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_key_uq" ON "departments" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_key_uq" ON "permissions" USING btree ("key");--> statement-breakpoint
CREATE INDEX "role_permissions_permission_idx" ON "role_permissions" USING btree ("permission_key");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_key_uq" ON "roles" USING btree ("key");--> statement-breakpoint
CREATE INDEX "roles_level_idx" ON "roles" USING btree ("level");--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "faction_categories_key_uq" ON "faction_categories" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "faction_positions_faction_key_uq" ON "faction_positions" USING btree ("faction_id","key");--> statement-breakpoint
CREATE INDEX "faction_positions_faction_idx" ON "faction_positions" USING btree ("faction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "factions_key_uq" ON "factions" USING btree ("key");--> statement-breakpoint
CREATE INDEX "factions_department_idx" ON "factions" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "disciplinary_actions_term_idx" ON "disciplinary_actions" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "disciplinary_actions_user_idx" ON "disciplinary_actions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "disciplinary_actions_type_idx" ON "disciplinary_actions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "leadership_points_history_term_idx" ON "leadership_points_history" USING btree ("term_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leadership_terms_position_number_uq" ON "leadership_terms" USING btree ("position_id","term_number");--> statement-breakpoint
CREATE INDEX "leadership_terms_user_idx" ON "leadership_terms" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "leadership_terms_faction_status_idx" ON "leadership_terms" USING btree ("faction_id","status");--> statement-breakpoint
CREATE INDEX "leadership_terms_position_status_idx" ON "leadership_terms" USING btree ("position_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_accounts_faction_uq" ON "budget_accounts" USING btree ("faction_id");--> statement-breakpoint
CREATE INDEX "budget_transactions_faction_idx" ON "budget_transactions" USING btree ("faction_id");--> statement-breakpoint
CREATE INDEX "budget_transactions_account_idx" ON "budget_transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "budget_transactions_created_idx" ON "budget_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "game_activity_user_idx" ON "game_activity" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "game_activity_faction_idx" ON "game_activity" USING btree ("faction_id");--> statement-breakpoint
CREATE INDEX "game_activity_occurred_idx" ON "game_activity" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_api_keys_prefix_uq" ON "integration_api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "integration_events_created_idx" ON "integration_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","read_at");