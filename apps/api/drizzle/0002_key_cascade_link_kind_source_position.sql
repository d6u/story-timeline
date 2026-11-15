-- Rebuilds the 9 child tables to add ON UPDATE CASCADE to all 20 foreign keys, the new CHECKs,
-- the unique link index, event_links.kind, and event_sources.position. Hand-edited after
-- `drizzle-kit generate`: the copies leave out the two new columns (they stay NULL), the CHECKs use
-- plain column names instead of the `__new_*` table name, and a guard aborts the migration when a
-- foreign key does not resolve after the rebuild. The libsql migrator runs every statement in one
-- transaction with foreign keys off, so the PRAGMA lines below are no-ops there.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_arc_stages` (
	`character_key` text NOT NULL,
	`position` integer NOT NULL,
	`stage` text,
	`time` text,
	`since` text,
	`description` text,
	PRIMARY KEY(`character_key`, `position`),
	FOREIGN KEY (`character_key`) REFERENCES `characters`(`key`) ON UPDATE cascade ON DELETE no action,
	FOREIGN KEY (`since`) REFERENCES `events`(`key`) ON UPDATE cascade ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_arc_stages`("character_key", "position", "stage", "time", "since", "description") SELECT "character_key", "position", "stage", "time", "since", "description" FROM `arc_stages`;--> statement-breakpoint
DROP TABLE `arc_stages`;--> statement-breakpoint
ALTER TABLE `__new_arc_stages` RENAME TO `arc_stages`;--> statement-breakpoint
CREATE TABLE `__new_character_names` (
	`character_key` text NOT NULL,
	`name` text NOT NULL,
	`position` integer,
	`lang` text,
	`note` text,
	PRIMARY KEY(`character_key`, `name`),
	FOREIGN KEY (`character_key`) REFERENCES `characters`(`key`) ON UPDATE cascade ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_character_names`("character_key", "name", "position", "lang", "note") SELECT "character_key", "name", "position", "lang", "note" FROM `character_names`;--> statement-breakpoint
DROP TABLE `character_names`;--> statement-breakpoint
ALTER TABLE `__new_character_names` RENAME TO `character_names`;--> statement-breakpoint
CREATE TABLE `__new_character_relations` (
	`character_key` text NOT NULL,
	`position` integer NOT NULL,
	`other_key` text NOT NULL,
	`relation` text,
	`mutual` integer DEFAULT false NOT NULL,
	`member` integer DEFAULT false NOT NULL,
	`since` text,
	`until` text,
	PRIMARY KEY(`character_key`, `position`),
	FOREIGN KEY (`character_key`) REFERENCES `characters`(`key`) ON UPDATE cascade ON DELETE no action,
	FOREIGN KEY (`other_key`) REFERENCES `characters`(`key`) ON UPDATE cascade ON DELETE no action,
	FOREIGN KEY (`since`) REFERENCES `events`(`key`) ON UPDATE cascade ON DELETE no action,
	FOREIGN KEY (`until`) REFERENCES `events`(`key`) ON UPDATE cascade ON DELETE no action,
	CONSTRAINT "character_relations_mutual" CHECK("mutual" IN (0, 1)),
	CONSTRAINT "character_relations_member" CHECK("member" IN (0, 1)),
	CONSTRAINT "member_is_one_way" CHECK("member" = 0 OR "mutual" = 0),
	CONSTRAINT "character_relations_not_self" CHECK("character_key" <> "other_key")
);
--> statement-breakpoint
INSERT INTO `__new_character_relations`("character_key", "position", "other_key", "relation", "mutual", "member", "since", "until") SELECT "character_key", "position", "other_key", "relation", "mutual", "member", "since", "until" FROM `character_relations`;--> statement-breakpoint
DROP TABLE `character_relations`;--> statement-breakpoint
ALTER TABLE `__new_character_relations` RENAME TO `character_relations`;--> statement-breakpoint
CREATE TABLE `__new_event_characters` (
	`event_key` text NOT NULL,
	`character_key` text NOT NULL,
	`position` integer,
	`presence` text,
	`exit` text,
	PRIMARY KEY(`event_key`, `character_key`),
	FOREIGN KEY (`event_key`) REFERENCES `events`(`key`) ON UPDATE cascade ON DELETE no action,
	FOREIGN KEY (`character_key`) REFERENCES `characters`(`key`) ON UPDATE cascade ON DELETE no action,
	CONSTRAINT "event_characters_presence" CHECK("presence" IN ('body', 'mind', 'spirit', 'mentioned', 'related')),
	CONSTRAINT "event_characters_exit" CHECK("exit" IN ('dies', 'leaves'))
);
--> statement-breakpoint
INSERT INTO `__new_event_characters`("event_key", "character_key", "position", "presence", "exit") SELECT "event_key", "character_key", "position", "presence", "exit" FROM `event_characters`;--> statement-breakpoint
DROP TABLE `event_characters`;--> statement-breakpoint
ALTER TABLE `__new_event_characters` RENAME TO `event_characters`;--> statement-breakpoint
CREATE TABLE `__new_event_links` (
	`event_key` text NOT NULL,
	`position` integer NOT NULL,
	`to_key` text NOT NULL,
	`relation` text,
	`mutual` integer DEFAULT false NOT NULL,
	`note` text,
	`kind` text,
	PRIMARY KEY(`event_key`, `position`),
	FOREIGN KEY (`event_key`) REFERENCES `events`(`key`) ON UPDATE cascade ON DELETE no action,
	FOREIGN KEY (`to_key`) REFERENCES `events`(`key`) ON UPDATE cascade ON DELETE no action,
	CONSTRAINT "event_links_mutual" CHECK("mutual" IN (0, 1)),
	CONSTRAINT "event_links_kind" CHECK("kind" IN ('cause', 'setup', 'reveal', 'echo')),
	CONSTRAINT "event_links_not_self" CHECK("event_key" <> "to_key")
);
--> statement-breakpoint
INSERT INTO `__new_event_links`("event_key", "position", "to_key", "relation", "mutual", "note") SELECT "event_key", "position", "to_key", "relation", "mutual", "note" FROM `event_links`;--> statement-breakpoint
DROP TABLE `event_links`;--> statement-breakpoint
ALTER TABLE `__new_event_links` RENAME TO `event_links`;--> statement-breakpoint
CREATE UNIQUE INDEX `event_links_pair_relation_unique` ON `event_links` (`event_key`,`to_key`,`relation`);--> statement-breakpoint
CREATE TABLE `__new_event_sources` (
	`event_key` text NOT NULL,
	`source_key` text NOT NULL,
	`ref` text,
	`position` integer,
	PRIMARY KEY(`event_key`, `source_key`),
	FOREIGN KEY (`event_key`) REFERENCES `events`(`key`) ON UPDATE cascade ON DELETE no action,
	FOREIGN KEY (`source_key`) REFERENCES `sources`(`key`) ON UPDATE cascade ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_event_sources`("event_key", "source_key", "ref") SELECT "event_key", "source_key", "ref" FROM `event_sources`;--> statement-breakpoint
DROP TABLE `event_sources`;--> statement-breakpoint
ALTER TABLE `__new_event_sources` RENAME TO `event_sources`;--> statement-breakpoint
CREATE TABLE `__new_events` (
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
	FOREIGN KEY (`act`) REFERENCES `acts`(`name`) ON UPDATE cascade ON DELETE no action,
	FOREIGN KEY (`place_key`) REFERENCES `places`(`key`) ON UPDATE cascade ON DELETE no action,
	CONSTRAINT "events_is_core" CHECK("is_core" IN (0, 1)),
	CONSTRAINT "events_confidence" CHECK("confidence" IN ('likely', 'unsure'))
);
--> statement-breakpoint
INSERT INTO `__new_events`("key", "id", "title", "description", "is_core", "sort_order", "act", "time", "place_key", "confidence") SELECT "key", "id", "title", "description", "is_core", "sort_order", "act", "time", "place_key", "confidence" FROM `events`;--> statement-breakpoint
DROP TABLE `events`;--> statement-breakpoint
ALTER TABLE `__new_events` RENAME TO `events`;--> statement-breakpoint
CREATE UNIQUE INDEX `events_id_unique` ON `events` (`id`);--> statement-breakpoint
CREATE TABLE `__new_learning_characters` (
	`learning_key` text NOT NULL,
	`position` integer NOT NULL,
	`character_key` text NOT NULL,
	`since` text,
	`until` text,
	`time` text,
	`note` text,
	PRIMARY KEY(`learning_key`, `position`),
	FOREIGN KEY (`learning_key`) REFERENCES `learnings`(`key`) ON UPDATE cascade ON DELETE no action,
	FOREIGN KEY (`character_key`) REFERENCES `characters`(`key`) ON UPDATE cascade ON DELETE no action,
	FOREIGN KEY (`since`) REFERENCES `events`(`key`) ON UPDATE cascade ON DELETE no action,
	FOREIGN KEY (`until`) REFERENCES `events`(`key`) ON UPDATE cascade ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_learning_characters`("learning_key", "position", "character_key", "since", "until", "time", "note") SELECT "learning_key", "position", "character_key", "since", "until", "time", "note" FROM `learning_characters`;--> statement-breakpoint
DROP TABLE `learning_characters`;--> statement-breakpoint
ALTER TABLE `__new_learning_characters` RENAME TO `learning_characters`;--> statement-breakpoint
CREATE TABLE `__new_places` (
	`key` text PRIMARY KEY NOT NULL,
	`position` integer,
	`name` text,
	`realm` text DEFAULT 'physical' NOT NULL,
	`parent` text,
	`description` text,
	FOREIGN KEY (`parent`) REFERENCES `places`(`key`) ON UPDATE cascade ON DELETE no action,
	CONSTRAINT "places_realm" CHECK("realm" IN ('physical', 'mind', 'dream', 'spirit')),
	CONSTRAINT "places_not_own_parent" CHECK("parent" <> "key")
);
--> statement-breakpoint
INSERT INTO `__new_places`("key", "position", "name", "realm", "parent", "description") SELECT "key", "position", "name", "realm", "parent", "description" FROM `places`;--> statement-breakpoint
DROP TABLE `places`;--> statement-breakpoint
ALTER TABLE `__new_places` RENAME TO `places`;--> statement-breakpoint
CREATE UNIQUE INDEX `places_position_unique` ON `places` (`position`);--> statement-breakpoint
CREATE TEMP TABLE `__fk_guard` (`broken` integer NOT NULL CHECK(`broken` = 0));--> statement-breakpoint
INSERT INTO `__fk_guard` SELECT count(*) FROM pragma_foreign_key_check;--> statement-breakpoint
DROP TABLE `__fk_guard`;--> statement-breakpoint
PRAGMA foreign_keys=ON;