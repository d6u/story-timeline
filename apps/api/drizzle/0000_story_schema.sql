CREATE TABLE `acts` (
	`name` text PRIMARY KEY NOT NULL,
	`position` integer,
	`span` text,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `acts_position_unique` ON `acts` (`position`);--> statement-breakpoint
CREATE TABLE `arc_stages` (
	`character_key` text NOT NULL,
	`position` integer NOT NULL,
	`stage` text,
	`time` text,
	`since` text,
	`description` text,
	PRIMARY KEY(`character_key`, `position`),
	FOREIGN KEY (`character_key`) REFERENCES `characters`(`key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`since`) REFERENCES `events`(`key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_names` (
	`character_key` text NOT NULL,
	`name` text NOT NULL,
	`position` integer,
	`lang` text,
	`note` text,
	PRIMARY KEY(`character_key`, `name`),
	FOREIGN KEY (`character_key`) REFERENCES `characters`(`key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_relations` (
	`character_key` text NOT NULL,
	`position` integer NOT NULL,
	`other_key` text NOT NULL,
	`relation` text,
	`mutual` integer DEFAULT false NOT NULL,
	`member` integer DEFAULT false NOT NULL,
	`since` text,
	`until` text,
	PRIMARY KEY(`character_key`, `position`),
	FOREIGN KEY (`character_key`) REFERENCES `characters`(`key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`other_key`) REFERENCES `characters`(`key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`since`) REFERENCES `events`(`key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`until`) REFERENCES `events`(`key`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "character_relations_mutual" CHECK("character_relations"."mutual" IN (0, 1)),
	CONSTRAINT "character_relations_member" CHECK("character_relations"."member" IN (0, 1)),
	CONSTRAINT "member_is_one_way" CHECK("character_relations"."member" = 0 OR "character_relations"."mutual" = 0)
);
--> statement-breakpoint
CREATE TABLE `characters` (
	`key` text PRIMARY KEY NOT NULL,
	`id` text,
	`name` text,
	`description` text,
	`category` text,
	`kind` text DEFAULT 'person' NOT NULL,
	`position` integer,
	CONSTRAINT "characters_kind" CHECK("characters"."kind" IN ('person', 'group'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `characters_id_unique` ON `characters` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `characters_position_unique` ON `characters` (`position`);--> statement-breakpoint
CREATE TABLE `event_characters` (
	`event_key` text NOT NULL,
	`character_key` text NOT NULL,
	`position` integer,
	`presence` text,
	`exit` text,
	PRIMARY KEY(`event_key`, `character_key`),
	FOREIGN KEY (`event_key`) REFERENCES `events`(`key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`character_key`) REFERENCES `characters`(`key`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "event_characters_presence" CHECK("event_characters"."presence" IN ('body', 'mind', 'spirit', 'mentioned', 'related')),
	CONSTRAINT "event_characters_exit" CHECK("event_characters"."exit" IN ('dies', 'leaves'))
);
--> statement-breakpoint
CREATE TABLE `event_links` (
	`event_key` text NOT NULL,
	`position` integer NOT NULL,
	`to_key` text NOT NULL,
	`relation` text,
	`mutual` integer DEFAULT false NOT NULL,
	`note` text,
	PRIMARY KEY(`event_key`, `position`),
	FOREIGN KEY (`event_key`) REFERENCES `events`(`key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_key`) REFERENCES `events`(`key`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "event_links_mutual" CHECK("event_links"."mutual" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `event_sources` (
	`event_key` text NOT NULL,
	`source_key` text NOT NULL,
	`ref` text,
	PRIMARY KEY(`event_key`, `source_key`),
	FOREIGN KEY (`event_key`) REFERENCES `events`(`key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_key`) REFERENCES `sources`(`key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `events` (
	`key` text PRIMARY KEY NOT NULL,
	`id` text,
	`title` text,
	`description` text,
	`is_core` integer DEFAULT false NOT NULL,
	`sort_order` integer,
	`act` text NOT NULL,
	`time` text,
	`place_key` text,
	`confidence` text,
	FOREIGN KEY (`act`) REFERENCES `acts`(`name`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`place_key`) REFERENCES `places`(`key`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "events_is_core" CHECK("events"."is_core" IN (0, 1)),
	CONSTRAINT "events_confidence" CHECK("events"."confidence" IN ('likely', 'unsure'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_id_unique` ON `events` (`id`);--> statement-breakpoint
CREATE TABLE `learning_characters` (
	`learning_key` text NOT NULL,
	`position` integer NOT NULL,
	`character_key` text NOT NULL,
	`since` text,
	`until` text,
	`time` text,
	`note` text,
	PRIMARY KEY(`learning_key`, `position`),
	FOREIGN KEY (`learning_key`) REFERENCES `learnings`(`key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`character_key`) REFERENCES `characters`(`key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`since`) REFERENCES `events`(`key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`until`) REFERENCES `events`(`key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `learnings` (
	`key` text PRIMARY KEY NOT NULL,
	`position` integer,
	`text` text,
	`kind` text DEFAULT 'knowledge' NOT NULL,
	`description` text,
	CONSTRAINT "learnings_kind" CHECK("learnings"."kind" IN ('knowledge', 'realization', 'idea'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learnings_position_unique` ON `learnings` (`position`);--> statement-breakpoint
CREATE TABLE `places` (
	`key` text PRIMARY KEY NOT NULL,
	`position` integer,
	`name` text,
	`realm` text DEFAULT 'physical' NOT NULL,
	`parent` text,
	`description` text,
	FOREIGN KEY (`parent`) REFERENCES `places`(`key`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "places_realm" CHECK("places"."realm" IN ('physical', 'mind', 'dream', 'spirit'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `places_position_unique` ON `places` (`position`);--> statement-breakpoint
CREATE TABLE `sources` (
	`key` text PRIMARY KEY NOT NULL,
	`position` integer,
	`title` text,
	`lang` text,
	`location` text,
	`note` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_position_unique` ON `sources` (`position`);