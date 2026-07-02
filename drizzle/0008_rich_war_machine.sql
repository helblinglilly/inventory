CREATE TABLE `inventory_invite` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`email` text NOT NULL,
	`invited_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_invite_email_unique` ON `inventory_invite` (`email`);--> statement-breakpoint
CREATE INDEX `inventory_invite_owner_user_id_idx` ON `inventory_invite` (`owner_user_id`);--> statement-breakpoint
CREATE TABLE `inventory_share` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`member_user_id` text NOT NULL,
	`invited_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inventory_share_owner_user_id_idx` ON `inventory_share` (`owner_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_share_member_user_id_uidx` ON `inventory_share` (`member_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_share_owner_member_uidx` ON `inventory_share` (`owner_user_id`,`member_user_id`);