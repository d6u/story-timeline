-- Adds character_relations.tone, the explicit tone of a relation. Hand-edited after
-- `drizzle-kit generate`: drizzle proposed a rebuild of character_relations; a plain ADD COLUMN with
-- the same named CHECK gives the same table, keeps every row and foreign key as is, and leaves the
-- new column NULL on every existing row. The CHECK uses the plain column name.
ALTER TABLE `character_relations` ADD `tone` text CONSTRAINT "character_relations_tone" CHECK("tone" IN ('family', 'love', 'friend', 'work', 'hostile', 'other'));
