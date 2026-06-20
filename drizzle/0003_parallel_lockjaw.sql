CREATE TABLE `inventory_item_place_link` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`place_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `inventory_item`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `inventory_place`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inventory_item_place_link_item_id_idx` ON `inventory_item_place_link` (`item_id`);--> statement-breakpoint
CREATE INDEX `inventory_item_place_link_place_id_idx` ON `inventory_item_place_link` (`place_id`);--> statement-breakpoint
CREATE INDEX `inventory_item_place_link_user_id_idx` ON `inventory_item_place_link` (`user_id`);--> statement-breakpoint
INSERT INTO `inventory_item_place_link` (`id`, `item_id`, `place_id`, `user_id`, `created_at`, `updated_at`)
SELECT hex(randomblob(16)), `id`, `place_id`, `user_id`, `created_at`, `updated_at`
FROM `inventory_item`
WHERE `place_id` IS NOT NULL;
