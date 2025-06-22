import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Game sessions
export const gameSessions = pgTable("game_sessions", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 12 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  gmId: varchar("gm_id").notNull(),
  encounterSentence: text("encounter_sentence"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Session players
export const sessionPlayers = pgTable("session_players", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  userId: varchar("user_id").notNull(),
  nerve: integer("nerve").default(8),
  maxNerve: integer("max_nerve").default(8),
  turnOrder: integer("turn_order"),
  isActive: boolean("is_active").default(true),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Words dictionary
export const words = pgTable("words", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  word: varchar("word", { length: 50 }).notNull(),
  meaning: text("meaning").notNull(),
  potency: integer("potency").notNull(),
  ownerId: varchar("owner_id").notNull(),
  wordType: varchar("word_type", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Combat log
export const combatLog = pgTable("combat_log", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  playerId: varchar("player_id").notNull(),
  sentence: text("sentence").notNull(),
  usedWords: jsonb("used_words").notNull(), // Array of word IDs and potencies
  diceRoll: integer("dice_roll").notNull(),
  totalPotency: integer("total_potency").notNull(),
  finalResult: integer("final_result").notNull(),
  turnNumber: integer("turn_number").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const gameSessionsRelations = relations(gameSessions, ({ one, many }) => ({
  gm: one(users, {
    fields: [gameSessions.gmId],
    references: [users.id],
  }),
  players: many(sessionPlayers),
  words: many(words),
  combatLog: many(combatLog),
}));

export const sessionPlayersRelations = relations(sessionPlayers, ({ one }) => ({
  session: one(gameSessions, {
    fields: [sessionPlayers.sessionId],
    references: [gameSessions.id],
  }),
  user: one(users, {
    fields: [sessionPlayers.userId],
    references: [users.id],
  }),
}));

export const wordsRelations = relations(words, ({ one }) => ({
  session: one(gameSessions, {
    fields: [words.sessionId],
    references: [gameSessions.id],
  }),
  owner: one(users, {
    fields: [words.ownerId],
    references: [users.id],
  }),
}));

export const combatLogRelations = relations(combatLog, ({ one }) => ({
  session: one(gameSessions, {
    fields: [combatLog.sessionId],
    references: [gameSessions.id],
  }),
  player: one(users, {
    fields: [combatLog.playerId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertGameSessionSchema = createInsertSchema(gameSessions).omit({
  id: true,
  createdAt: true,
});

export const insertSessionPlayerSchema = createInsertSchema(sessionPlayers).omit({
  id: true,
  joinedAt: true,
});

export const insertWordSchema = createInsertSchema(words).omit({
  id: true,
  createdAt: true,
});

export const insertCombatLogSchema = createInsertSchema(combatLog).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type GameSession = typeof gameSessions.$inferSelect;
export type InsertGameSession = z.infer<typeof insertGameSessionSchema>;
export type SessionPlayer = typeof sessionPlayers.$inferSelect;
export type InsertSessionPlayer = z.infer<typeof insertSessionPlayerSchema>;
export type Word = typeof words.$inferSelect;
export type InsertWord = z.infer<typeof insertWordSchema>;
export type CombatLogEntry = typeof combatLog.$inferSelect;
export type InsertCombatLogEntry = z.infer<typeof insertCombatLogSchema>;
