CREATE TABLE `meal_plan` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`planned_for` text NOT NULL,
	`meal_slot` text DEFAULT 'dinner' NOT NULL,
	`recipe_id` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `meal_plan_user_id_idx` ON `meal_plan` (`user_id`);--> statement-breakpoint
CREATE INDEX `meal_plan_planned_for_idx` ON `meal_plan` (`planned_for`);--> statement-breakpoint
CREATE TABLE `recipe_ingredient` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`user_id` text NOT NULL,
	`item_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_label` text,
	`include_in_cost` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `inventory_item`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_ingredient_recipe_id_idx` ON `recipe_ingredient` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `recipe_ingredient_item_id_idx` ON `recipe_ingredient` (`item_id`);--> statement-breakpoint
CREATE INDEX `recipe_ingredient_user_id_idx` ON `recipe_ingredient` (`user_id`);--> statement-breakpoint
CREATE TABLE `recipe` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`image_url` text,
	`image_proxy_url` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recipe_user_id_idx` ON `recipe` (`user_id`);--> statement-breakpoint
CREATE INDEX `recipe_name_idx` ON `recipe` (`name`);--> statement-breakpoint
CREATE TABLE `shopping_list_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`user_id` text NOT NULL,
	`item_id` text,
	`recipe_id` text,
	`label` text NOT NULL,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_label` text,
	`checked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `shopping_list`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `inventory_item`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `shopping_list_entry_list_id_idx` ON `shopping_list_entry` (`list_id`);--> statement-breakpoint
CREATE INDEX `shopping_list_entry_user_id_idx` ON `shopping_list_entry` (`user_id`);--> statement-breakpoint
CREATE INDEX `shopping_list_entry_item_id_idx` ON `shopping_list_entry` (`item_id`);--> statement-breakpoint
CREATE TABLE `shopping_list` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`cleared_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shopping_list_user_id_idx` ON `shopping_list` (`user_id`);--> statement-breakpoint
CREATE INDEX `shopping_list_status_idx` ON `shopping_list` (`status`);--> statement-breakpoint
ALTER TABLE `inventory_item` ADD `is_staple` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_item` ADD `track_price_history` integer DEFAULT false NOT NULL;