CREATE TABLE `gift_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`url` text,
	`image_key` text,
	`image_mime_type` text,
	`estimated_price_cents` integer,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "gift_suggestions_title_not_blank" CHECK(length(trim("gift_suggestions"."title")) > 0),
	CONSTRAINT "gift_suggestions_price_nonnegative" CHECK("gift_suggestions"."estimated_price_cents" is null or "gift_suggestions"."estimated_price_cents" >= 0),
	CONSTRAINT "gift_suggestions_image_pair_check" CHECK(("gift_suggestions"."image_key" is null) = ("gift_suggestions"."image_mime_type" is null)),
	CONSTRAINT "gift_suggestions_image_mime_check" CHECK("gift_suggestions"."image_mime_type" is null or "gift_suggestions"."image_mime_type" in ('image/jpeg', 'image/png', 'image/webp'))
);
--> statement-breakpoint
CREATE INDEX `gift_suggestions_owner_updated_idx` ON `gift_suggestions` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `gift_suggestions_image_key_unique` ON `gift_suggestions` (`image_key`);