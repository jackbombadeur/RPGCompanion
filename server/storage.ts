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

// In-memory storage for demo mode (no database required)
export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private sessions: Map<number, GameSession> = new Map();
  private sessionPlayers: Map<string, SessionPlayer> = new Map();
  private words: Map<number, Word> = new Map();
  private combatLogs: Map<number, CombatLogEntry> = new Map();
  private sessionCounter = 1;
  private wordCounter = 1;
  private logCounter = 1;

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const user: User = {
      id: userData.id,
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      profileImageUrl: userData.profileImageUrl || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(userData.id, user);
    return user;
  }

  async createGameSession(session: InsertGameSession): Promise<GameSession> {
    const newSession: GameSession = {
      id: this.sessionCounter++,
      code: session.code,
      name: session.name,
      gmId: session.gmId,
      encounterSentence: session.encounterSentence || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(newSession.id, newSession);
    return newSession;
  }

  async getGameSessionByCode(code: string): Promise<GameSession | undefined> {
    return Array.from(this.sessions.values()).find(s => s.code === code);
  }

  async getGameSession(id: number): Promise<GameSession | undefined> {
    return this.sessions.get(id);
  }

  async updateEncounterSentence(sessionId: number, sentence: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.encounterSentence = sentence;
      session.updatedAt = new Date();
    }
  }

  async joinSession(player: InsertSessionPlayer): Promise<SessionPlayer> {
    const newPlayer: SessionPlayer = {
      sessionId: player.sessionId,
      userId: player.userId,
      nerve: player.nerve,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessionPlayers.set(`${player.sessionId}-${player.userId}`, newPlayer);
    return newPlayer;
  }

  async getSessionPlayers(sessionId: number): Promise<SessionPlayer[]> {
    return Array.from(this.sessionPlayers.values()).filter(p => p.sessionId === sessionId);
  }

  async updatePlayerNerve(sessionId: number, userId: string, nerve: number): Promise<void> {
    const key = `${sessionId}-${userId}`;
    const player = this.sessionPlayers.get(key);
    if (player) {
      player.nerve = nerve;
      player.updatedAt = new Date();
    }
  }

  async getPlayerInSession(sessionId: number, userId: string): Promise<SessionPlayer | undefined> {
    return this.sessionPlayers.get(`${sessionId}-${userId}`);
  }

  async createWord(word: InsertWord): Promise<Word> {
    const newWord: Word = {
      id: this.wordCounter++,
      sessionId: word.sessionId,
      text: word.text,
      category: word.category,
      potency: word.potency,
      ownerId: word.ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.words.set(newWord.id, newWord);
    return newWord;
  }

  async getSessionWords(sessionId: number): Promise<Word[]> {
    return Array.from(this.words.values()).filter(w => w.sessionId === sessionId);
  }

  async getPlayerWords(sessionId: number, ownerId: string): Promise<Word[]> {
    return Array.from(this.words.values()).filter(w => w.sessionId === sessionId && w.ownerId === ownerId);
  }

  async addCombatLogEntry(entry: InsertCombatLogEntry): Promise<CombatLogEntry> {
    const newEntry: CombatLogEntry = {
      id: this.logCounter++,
      sessionId: entry.sessionId,
      userId: entry.userId,
      action: entry.action,
      result: entry.result,
      createdAt: new Date(),
    };
    this.combatLogs.set(newEntry.id, newEntry);
    return newEntry;
  }

  async getCombatLog(sessionId: number): Promise<CombatLogEntry[]> {
    return Array.from(this.combatLogs.values())
      .filter(log => log.sessionId === sessionId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export class DatabaseStorage implements IStorage {
  constructor() {
    if (!db) {
      throw new Error("Database not initialized. DATABASE_URL is required for DatabaseStorage.");
    }
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    if (!db) throw new Error("Database not available");
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    if (!db) throw new Error("Database not available");
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
    if (!db) throw new Error("Database not available");
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
    if (!db) throw new Error("Database not available");
    await db
      .update(gameSessions)
      .set({ encounterSentence: sentence })
      .where(eq(gameSessions.id, sessionId));
  }

  // Session player operations
  async joinSession(player: InsertSessionPlayer): Promise<SessionPlayer> {
    if (!db) throw new Error("Database not available");
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
    if (!db) throw new Error("Database not available");
    await db
      .update(sessionPlayers)
      .set({ nerve })
      .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.userId, userId)));
  }

  async getPlayerInSession(sessionId: number, userId: string): Promise<SessionPlayer | undefined> {
    if (!db) throw new Error("Database not available");
    const [player] = await db
      .select()
      .from(sessionPlayers)
      .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.userId, userId)));
    return player;
  }

  // Word operations
  async createWord(word: InsertWord): Promise<Word> {
    if (!db) throw new Error("Database not available");
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
    if (!db) throw new Error("Database not available");
    return await db
      .select()
      .from(words)
      .where(and(eq(words.sessionId, sessionId), eq(words.ownerId, ownerId)));
  }

  // Combat log operations
  async addCombatLogEntry(entry: InsertCombatLogEntry): Promise<CombatLogEntry> {
    if (!db) throw new Error("Database not available");
    const [newEntry] = await db
      .insert(combatLog)
      .values(entry)
      .returning();
    return newEntry;
  }

  async getCombatLog(sessionId: number): Promise<CombatLogEntry[]> {
    if (!db) throw new Error("Database not available");
    return await db
      .select()
      .from(combatLog)
      .where(eq(combatLog.sessionId, sessionId))
      .orderBy(desc(combatLog.createdAt));
  }
}

// Use database storage if DATABASE_URL is provided, otherwise use in-memory storage
export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();
