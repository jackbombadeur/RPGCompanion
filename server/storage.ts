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
import { eq, and, desc, isNull } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Game session operations
  createGameSession(session: InsertGameSession): Promise<GameSession>;
  getGameSessionByCode(code: string): Promise<GameSession | undefined>;
  getGameSession(id: number): Promise<GameSession | undefined>;
  updateEncounterSentence(sessionId: number, sentence: string): Promise<void>;
  advanceToNextPlayer(sessionId: number): Promise<{ nextPlayerId: string; turnIncremented: boolean }>;
  resetTurnsForNewEncounter(sessionId: number): Promise<void>;
  recalculateTurnOrder(sessionId: number): Promise<void>;
  addPlayerToTurnOrder(sessionId: number, userId: string): Promise<void>;
  
  // Session player operations
  joinSession(player: InsertSessionPlayer): Promise<SessionPlayer>;
  getSessionPlayers(sessionId: number): Promise<SessionPlayer[]>;
  updatePlayerNerve(sessionId: number, userId: string, nerve: number): Promise<void>;
  getPlayerInSession(sessionId: number, userId: string): Promise<SessionPlayer | undefined>;
  setActiveTurn(sessionId: number, userId: string): Promise<void>;
  
  // Word operations
  createWord(word: InsertWord): Promise<Word>;
  getSessionWords(sessionId: number): Promise<Word[]>;
  getPlayerWords(sessionId: number, ownerId: string): Promise<Word[]>;
  approveWord(wordId: number, potency: number): Promise<Word>;
  getPendingWords(sessionId: number): Promise<Word[]>;
  deleteWord(wordId: number): Promise<void>;
  
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
      currentTurn: session.currentTurn || 1,
      isActive: session.isActive ?? true,
      createdAt: new Date(),
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
    }
  }

  async joinSession(player: InsertSessionPlayer): Promise<SessionPlayer> {
    const newPlayer: SessionPlayer = {
      id: this.sessionCounter++,
      sessionId: player.sessionId,
      userId: player.userId,
      playerName: player.playerName || null,
      nerve: player.nerve || 8,
      maxNerve: player.maxNerve || 8,
      turnOrder: player.turnOrder || null,
      isActive: player.isActive ?? true,
      isActiveTurn: player.isActiveTurn ?? false,
      joinedAt: new Date(),
    };
    this.sessionPlayers.set(`${player.sessionId}-${player.userId}`, newPlayer);
    return newPlayer;
  }

  async getSessionPlayers(sessionId: number): Promise<SessionPlayer[]> {
    return Array.from(this.sessionPlayers.values())
      .filter(p => p.sessionId === sessionId && p.isActive)
      .sort((a, b) => (a.turnOrder || 0) - (b.turnOrder || 0));
  }

  async updatePlayerNerve(sessionId: number, userId: string, nerve: number): Promise<void> {
    const key = `${sessionId}-${userId}`;
    const player = this.sessionPlayers.get(key);
    if (player) {
      player.nerve = nerve;
    }
  }

  async getPlayerInSession(sessionId: number, userId: string): Promise<SessionPlayer | undefined> {
    return this.sessionPlayers.get(`${sessionId}-${userId}`);
  }

  async createWord(word: InsertWord): Promise<Word> {
    const newWord: Word = {
      id: this.wordCounter++,
      word: word.word,
      sessionId: word.sessionId,
      meaning: word.meaning,
      potency: word.potency || null,
      ownerId: word.ownerId,
      isApproved: word.isApproved || false,
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

  async approveWord(wordId: number, potency: number): Promise<Word> {
    const word = this.words.get(wordId);
    if (word) {
      word.potency = potency;
      word.isApproved = true;
      word.updatedAt = new Date();
      this.words.set(wordId, word);
      return word;
    }
    throw new Error("Word not found");
  }

  async getPendingWords(sessionId: number): Promise<Word[]> {
    return Array.from(this.words.values()).filter(w => w.sessionId === sessionId && w.potency === null);
  }

  async deleteWord(wordId: number): Promise<void> {
    this.words.delete(wordId);
  }

  async addCombatLogEntry(entry: InsertCombatLogEntry): Promise<CombatLogEntry> {
    const newEntry: CombatLogEntry = {
      id: this.logCounter++,
      sessionId: entry.sessionId,
      playerId: entry.playerId,
      sentence: entry.sentence,
      usedWords: entry.usedWords,
      diceRoll: entry.diceRoll,
      totalPotency: entry.totalPotency,
      finalResult: entry.finalResult,
      turnNumber: entry.turnNumber,
      createdAt: new Date(),
    };
    this.combatLogs.set(newEntry.id, newEntry);
    return newEntry;
  }

  async getCombatLog(sessionId: number): Promise<CombatLogEntry[]> {
    return Array.from(this.combatLogs.values())
      .filter(log => log.sessionId === sessionId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async setActiveTurn(sessionId: number, userId: string): Promise<void> {
    // Reset all players' active turn status
    Array.from(this.sessionPlayers.entries()).forEach(([key, player]) => {
      if (player.sessionId === sessionId) {
        player.isActiveTurn = false;
        this.sessionPlayers.set(key, player);
      }
    });
    
    // Set the specified player as active
    const key = `${sessionId}-${userId}`;
    const player = this.sessionPlayers.get(key);
    if (player) {
      player.isActiveTurn = true;
      this.sessionPlayers.set(key, player);
    }
  }

  async advanceToNextPlayer(sessionId: number): Promise<{ nextPlayerId: string; turnIncremented: boolean }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Get all players in the session, sorted by turn order
    const players = Array.from(this.sessionPlayers.values())
      .filter(p => p.sessionId === sessionId)
      .sort((a, b) => (a.turnOrder || 0) - (b.turnOrder || 0));

    if (players.length === 0) {
      throw new Error("No players in session");
    }

    // Find current active player
    const currentActivePlayer = players.find(p => p.isActiveTurn);
    let currentIndex = -1;
    
    if (currentActivePlayer) {
      currentIndex = players.findIndex(p => p.userId === currentActivePlayer.userId);
    }

    // Determine next player
    let nextIndex = currentIndex + 1;
    let turnIncremented = false;

    // If we've gone through all players, start over and increment turn
    if (nextIndex >= players.length) {
      nextIndex = 0;
      turnIncremented = true;
      session.currentTurn = (session.currentTurn || 1) + 1;
    }

    const nextPlayer = players[nextIndex];

    // Reset all players' active turn status
    Array.from(this.sessionPlayers.entries()).forEach(([key, player]) => {
      if (player.sessionId === sessionId) {
        player.isActiveTurn = false;
        this.sessionPlayers.set(key, player);
      }
    });

    // Set the next player as active
    const nextPlayerKey = `${sessionId}-${nextPlayer.userId}`;
    const nextPlayerInStorage = this.sessionPlayers.get(nextPlayerKey);
    if (nextPlayerInStorage) {
      nextPlayerInStorage.isActiveTurn = true;
      this.sessionPlayers.set(nextPlayerKey, nextPlayerInStorage);
    }

    return { nextPlayerId: nextPlayer.userId, turnIncremented };
  }

  async resetTurnsForNewEncounter(sessionId: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.currentTurn = 1;
    }

    // Reset all players' active turn status
    Array.from(this.sessionPlayers.entries()).forEach(([key, player]) => {
      if (player.sessionId === sessionId) {
        player.isActiveTurn = false;
        this.sessionPlayers.set(key, player);
      }
    });
  }

  async recalculateTurnOrder(sessionId: number): Promise<void> {
    // Get all players in the session, sorted by nerve (highest first), then by join time (earliest first)
    const players = Array.from(this.sessionPlayers.values()).filter(p => p.sessionId === sessionId);
    
    // Sort players by nerve (highest first), then by join time (earliest first)
    const sortedPlayers = players.sort((a, b) => {
      if ((b.nerve || 0) !== (a.nerve || 0)) {
        return (b.nerve || 0) - (a.nerve || 0);
      }
      return (a.joinedAt?.getTime() || 0) - (b.joinedAt?.getTime() || 0);
    });

    // Update turn order for each player
    sortedPlayers.forEach((player, index) => {
      const key = `${sessionId}-${player.userId}`;
      const playerInStorage = this.sessionPlayers.get(key);
      if (playerInStorage) {
        playerInStorage.turnOrder = index;
        this.sessionPlayers.set(key, playerInStorage);
      }
    });
  }

  async addPlayerToTurnOrder(sessionId: number, userId: string): Promise<void> {
    // Get all players in the session
    const players = Array.from(this.sessionPlayers.values()).filter(p => p.sessionId === sessionId);
    
    // Find the highest turn order
    const maxTurnOrder = Math.max(...players.map(p => p.turnOrder || 0), -1);
    
    // Set the new player's turn order to the end
    const key = `${sessionId}-${userId}`;
    const player = this.sessionPlayers.get(key);
    if (player) {
      player.turnOrder = maxTurnOrder + 1;
      this.sessionPlayers.set(key, player);
    }
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
    if (!db) throw new Error("Database not available");
    const [session] = await db
      .select()
      .from(gameSessions)
      .where(and(eq(gameSessions.code, code), eq(gameSessions.isActive, true)));
    return session;
  }

  async getGameSession(id: number): Promise<GameSession | undefined> {
    if (!db) throw new Error("Database not available");
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
    if (!db) throw new Error("Database not available");
    return await db
      .select()
      .from(sessionPlayers)
      .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.isActive, true)))
      .orderBy(sessionPlayers.turnOrder);
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
    if (!db) throw new Error("Database not available");
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

  async approveWord(wordId: number, potency: number): Promise<Word> {
    if (!db) throw new Error("Database not available");
    const [updatedWord] = await db
      .update(words)
      .set({ potency, updatedAt: new Date() })
      .where(eq(words.id, wordId))
      .returning();
    return updatedWord;
  }

  async getPendingWords(sessionId: number): Promise<Word[]> {
    if (!db) throw new Error("Database not available");
    return await db
      .select()
      .from(words)
      .where(and(eq(words.sessionId, sessionId), isNull(words.potency)));
  }

  async deleteWord(wordId: number): Promise<void> {
    if (!db) throw new Error("Database not available");
    await db
      .delete(words)
      .where(eq(words.id, wordId));
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

  async setActiveTurn(sessionId: number, userId: string): Promise<void> {
    if (!db) throw new Error("Database not available");
    
    // Reset all players' active turn status
    await db
      .update(sessionPlayers)
      .set({ isActiveTurn: false })
      .where(eq(sessionPlayers.sessionId, sessionId));
    
    // Set the specified player as active
    await db
      .update(sessionPlayers)
      .set({ isActiveTurn: true })
      .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.userId, userId)));
  }

  async advanceToNextPlayer(sessionId: number): Promise<{ nextPlayerId: string; turnIncremented: boolean }> {
    if (!db) throw new Error("Database not available");
    
    // Get session
    const session = await this.getGameSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Get all players in the session, sorted by turn order
    const players = await db
      .select()
      .from(sessionPlayers)
      .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.isActive, true)))
      .orderBy(sessionPlayers.turnOrder);

    if (players.length === 0) {
      throw new Error("No players in session");
    }

    // Find current active player
    const currentActivePlayer = players.find(p => p.isActiveTurn);
    let currentIndex = -1;
    
    if (currentActivePlayer) {
      currentIndex = players.findIndex(p => p.userId === currentActivePlayer.userId);
    }

    // Determine next player
    let nextIndex = currentIndex + 1;
    let turnIncremented = false;

    // If we've gone through all players, start over and increment turn
    if (nextIndex >= players.length) {
      nextIndex = 0;
      turnIncremented = true;
      
      // Increment turn counter
      await db
        .update(gameSessions)
        .set({ currentTurn: (session.currentTurn || 1) + 1 })
        .where(eq(gameSessions.id, sessionId));
    }

    const nextPlayer = players[nextIndex];

    // Reset all players' active turn status
    await db
      .update(sessionPlayers)
      .set({ isActiveTurn: false })
      .where(eq(sessionPlayers.sessionId, sessionId));

    // Set the next player as active
    await db
      .update(sessionPlayers)
      .set({ isActiveTurn: true })
      .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.userId, nextPlayer.userId)));

    return { nextPlayerId: nextPlayer.userId, turnIncremented };
  }

  async resetTurnsForNewEncounter(sessionId: number): Promise<void> {
    if (!db) throw new Error("Database not available");
    
    // Get session
    const session = await this.getGameSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Reset turn counter
    await db
      .update(gameSessions)
      .set({ currentTurn: 1 })
      .where(eq(gameSessions.id, sessionId));

    // Reset all players' active turn status
    await db
      .update(sessionPlayers)
      .set({ isActiveTurn: false })
      .where(eq(sessionPlayers.sessionId, sessionId));
  }

  async recalculateTurnOrder(sessionId: number): Promise<void> {
    if (!db) throw new Error("Database not available");
    
    // Get all players in the session, sorted by nerve (highest first), then by join time (earliest first)
    const players = await db
      .select()
      .from(sessionPlayers)
      .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.isActive, true)))
      .orderBy(desc(sessionPlayers.nerve), sessionPlayers.joinedAt);

    // Update turn order for each player
    for (let i = 0; i < players.length; i++) {
      await db
        .update(sessionPlayers)
        .set({ turnOrder: i })
        .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.userId, players[i].userId)));
    }
  }

  async addPlayerToTurnOrder(sessionId: number, userId: string): Promise<void> {
    if (!db) throw new Error("Database not available");
    
    // Get the highest turn order
    const players = await db
      .select({ turnOrder: sessionPlayers.turnOrder })
      .from(sessionPlayers)
      .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.isActive, true)));
    
    const maxTurnOrder = Math.max(...players.map(p => p.turnOrder || 0), -1);
    
    // Set the new player's turn order to the end
    await db
      .update(sessionPlayers)
      .set({ turnOrder: maxTurnOrder + 1 })
      .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.userId, userId)));
  }
}

// Use database storage if DATABASE_URL is provided, otherwise use in-memory storage
export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();
