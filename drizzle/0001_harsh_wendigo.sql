CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`exchange_date` text NOT NULL,
	`gift_budget_cents` integer NOT NULL,
	`currency` text DEFAULT 'CAD' NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'setup' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "events_single_event_check" CHECK("events"."id" = 'main'),
	CONSTRAINT "events_name_not_blank" CHECK(length(trim("events"."name")) > 0),
	CONSTRAINT "events_budget_nonnegative_check" CHECK("events"."gift_budget_cents" >= 0),
	CONSTRAINT "events_currency_check" CHECK("events"."currency" = 'CAD'),
	CONSTRAINT "events_status_check" CHECK("events"."status" in ('setup', 'open', 'assignments_generated', 'completed')),
	CONSTRAINT "events_exchange_date_check" CHECK(strftime('%Y-%m-%d', "events"."exchange_date") is not null and strftime('%Y-%m-%d', "events"."exchange_date") = "events"."exchange_date")
);
--> statement-breakpoint
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "households_name_not_blank" CHECK(length(trim("households"."name")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `households_name_unique` ON `households` (lower("name"));--> statement-breakpoint
ALTER TABLE `users` ADD `household_id` text REFERENCES households(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `users_household_id_idx` ON `users` (`household_id`);