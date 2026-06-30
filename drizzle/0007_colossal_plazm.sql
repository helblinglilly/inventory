DROP INDEX "account_userId_idx";--> statement-breakpoint
DROP INDEX "session_token_unique";--> statement-breakpoint
DROP INDEX "session_userId_idx";--> statement-breakpoint
DROP INDEX "user_email_unique";--> statement-breakpoint
DROP INDEX "verification_identifier_idx";--> statement-breakpoint
DROP INDEX "inventory_item_place_link_item_id_idx";--> statement-breakpoint
DROP INDEX "inventory_item_place_link_place_id_idx";--> statement-breakpoint
DROP INDEX "inventory_item_place_link_user_id_idx";--> statement-breakpoint
DROP INDEX "inventory_item_place_id_idx";--> statement-breakpoint
DROP INDEX "inventory_item_user_id_idx";--> statement-breakpoint
DROP INDEX "inventory_item_name_idx";--> statement-breakpoint
DROP INDEX "meal_plan_user_id_idx";--> statement-breakpoint
DROP INDEX "meal_plan_planned_for_idx";--> statement-breakpoint
DROP INDEX "inventory_place_room_id_idx";--> statement-breakpoint
DROP INDEX "inventory_place_user_id_idx";--> statement-breakpoint
DROP INDEX "recipe_ingredient_recipe_id_idx";--> statement-breakpoint
DROP INDEX "recipe_ingredient_item_id_idx";--> statement-breakpoint
DROP INDEX "recipe_ingredient_user_id_idx";--> statement-breakpoint
DROP INDEX "recipe_user_id_idx";--> statement-breakpoint
DROP INDEX "recipe_name_idx";--> statement-breakpoint
DROP INDEX "inventory_room_user_id_idx";--> statement-breakpoint
DROP INDEX "inventory_room_sort_order_idx";--> statement-breakpoint
DROP INDEX "shopping_list_entry_list_id_idx";--> statement-breakpoint
DROP INDEX "shopping_list_entry_user_id_idx";--> statement-breakpoint
DROP INDEX "shopping_list_entry_item_id_idx";--> statement-breakpoint
DROP INDEX "shopping_list_user_id_idx";--> statement-breakpoint
DROP INDEX "shopping_list_status_idx";--> statement-breakpoint
ALTER TABLE `inventory_item` ALTER COLUMN "desired_stock" TO "desired_stock" real NOT NULL DEFAULT 1;--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE INDEX `inventory_item_place_link_item_id_idx` ON `inventory_item_place_link` (`item_id`);--> statement-breakpoint
CREATE INDEX `inventory_item_place_link_place_id_idx` ON `inventory_item_place_link` (`place_id`);--> statement-breakpoint
CREATE INDEX `inventory_item_place_link_user_id_idx` ON `inventory_item_place_link` (`user_id`);--> statement-breakpoint
CREATE INDEX `inventory_item_place_id_idx` ON `inventory_item` (`place_id`);--> statement-breakpoint
CREATE INDEX `inventory_item_user_id_idx` ON `inventory_item` (`user_id`);--> statement-breakpoint
CREATE INDEX `inventory_item_name_idx` ON `inventory_item` (`name`);--> statement-breakpoint
CREATE INDEX `meal_plan_user_id_idx` ON `meal_plan` (`user_id`);--> statement-breakpoint
CREATE INDEX `meal_plan_planned_for_idx` ON `meal_plan` (`planned_for`);--> statement-breakpoint
CREATE INDEX `inventory_place_room_id_idx` ON `inventory_place` (`room_id`);--> statement-breakpoint
CREATE INDEX `inventory_place_user_id_idx` ON `inventory_place` (`user_id`);--> statement-breakpoint
CREATE INDEX `recipe_ingredient_recipe_id_idx` ON `recipe_ingredient` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `recipe_ingredient_item_id_idx` ON `recipe_ingredient` (`item_id`);--> statement-breakpoint
CREATE INDEX `recipe_ingredient_user_id_idx` ON `recipe_ingredient` (`user_id`);--> statement-breakpoint
CREATE INDEX `recipe_user_id_idx` ON `recipe` (`user_id`);--> statement-breakpoint
CREATE INDEX `recipe_name_idx` ON `recipe` (`name`);--> statement-breakpoint
CREATE INDEX `inventory_room_user_id_idx` ON `inventory_room` (`user_id`);--> statement-breakpoint
CREATE INDEX `inventory_room_sort_order_idx` ON `inventory_room` (`sort_order`);--> statement-breakpoint
CREATE INDEX `shopping_list_entry_list_id_idx` ON `shopping_list_entry` (`list_id`);--> statement-breakpoint
CREATE INDEX `shopping_list_entry_user_id_idx` ON `shopping_list_entry` (`user_id`);--> statement-breakpoint
CREATE INDEX `shopping_list_entry_item_id_idx` ON `shopping_list_entry` (`item_id`);--> statement-breakpoint
CREATE INDEX `shopping_list_user_id_idx` ON `shopping_list` (`user_id`);--> statement-breakpoint
CREATE INDEX `shopping_list_status_idx` ON `shopping_list` (`status`);--> statement-breakpoint
ALTER TABLE `inventory_item` ALTER COLUMN "actual_stock" TO "actual_stock" real NOT NULL;