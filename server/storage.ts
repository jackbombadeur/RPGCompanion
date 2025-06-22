import {
  users,
  gameSessions,
  sessionPlayers,
  words,
  combatLog,
  type User,
  type UpsertUser,
  type GameSession,
  type InsertGameSession,
  type SessionPlayer,
  type InsertSessionPlayer,
  type Word,
  type InsertWord,
  type CombatLogEntry,
  type InsertCombatLogEntry,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Game session operations
  createGameSession(session: InsertGameSession): Promise<GameSession>;
  getGameSessionByCode(code: string): Promise<GameSession | undefined>;
  getGameSession(id: number): Promise<GameSession | undefined>;
  updateEncounterSentence(sessionId: number, sentence: string): Promise<void>;
  
  // Session player operations
  joinSession(player: InsertSessionPlayer): Promise<SessionPlayer>;
  getSessionPlayers(sessionId: number): Promise<SessionPlayer[]>;
  updatePlayerNerve(sessionId: number, userId: string, nerve: number): Promise<void>;
  getPlayerInSession(sessionId: number, userId: string): Promise<SessionPlayer | undefined>;
  
  // Word operations
  createWord(word: InsertWord): Promise<Word>;
  getSessionWords(sessionId: number): Promise<Word[]>;
  getPlayerWords(sessionId: number, ownerId: string): Promise<Word[]>;
  
  // Combat log operations
  addCombatLogEntry(entry: InsertCombatLogEntry): Promise<CombatLogEntry>;
  getCombatLog(sessionId: number): Promise<CombatLogEntry[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Game session operations
  async createGameSession(session: InsertGameSession): Promise<GameSession> {
    const [newSession] = await db
      .insert(gameSessions)
      .values(session)
      .returning();
    return newSession;
  }

  async getGameSessionByCode(code: string): Promise<GameSession | undefined> {
    const [session] = await db
      .select()
      .from(gameSessions)
      .where(and(eq(gameSessions.code, code), eq(gameSessions.isActive, true)));
    return session;
  }

  async getGameSession(id: number): Promise<GameSession | undefined> {
    const [session] = await db
      .select()
      .from(gameSessions)
      .where(eq(gameSessions.id, id));
    return session;
  }

  async updateEncounterSentence(sessionId: number, sentence: string): Promise<void> {
    await db
      .update(gameSessions)
      .set({ encounterSentence: sentence })
      .where(eq(gameSessions.id, sessionId));
  }

  // Session player operations
  async joinSession(player: InsertSessionPlayer): Promise<SessionPlayer> {
    const [newPlayer] = await db
      .insert(sessionPlayers)
      .values(player)
      .returning();
    return newPlayer;
  }

  async getSessionPlayers(sessionId: number): Promise<SessionPlayer[]> {
    return await db
      .select()
      .from(sessionPlayers)
      .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.isActive, true)))
      .orderBy(desc(sessionPlayers.nerve));
  }

  async updatePlayerNerve(sessionId: number, userId: string, nerve: number): Promise<void> {
    await db
      .update(sessionPlayers)
      .set({ nerve })
      .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.userId, userId)));
  }

  async getPlayerInSession(sessionId: number, userId: string): Promise<SessionPlayer | undefined> {
    const [player] = await db
      .select()
      .from(sessionPlayers)
      .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.userId, userId)));
    return player;
  }

  // Word operations
  async createWord(word: InsertWord): Promise<Word> {
    const [newWord] = await db
      .insert(words)
      .values(word)
      .returning();
    return newWord;
  }

  async getSessionWords(sessionId: number): Promise<Word[]> {
    return await db
      .select()
      .from(words)
      .where(eq(words.sessionId, sessionId));
  }

  async getPlayerWords(sessionId: number, ownerId: string): Promise<Word[]> {
    return await db
      .select()
      .from(words)
      .where(and(eq(words.sessionId, sessionId), eq(words.ownerId, ownerId)));
  }

  // Combat log operations
  async addCombatLogEntry(entry: InsertCombatLogEntry): Promise<CombatLogEntry> {
    const [newEntry] = await db
      .insert(combatLog)
      .values(entry)
      .returning();
    return newEntry;
  }

  async getCombatLog(sessionId: number): Promise<CombatLogEntry[]> {
    return await db
      .select()
      .from(combatLog)
      .where(eq(combatLog.sessionId, sessionId))
      .orderBy(desc(combatLog.createdAt));
  }
}

export const storage = new DatabaseStorage();
