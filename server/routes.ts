import express, { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertGameSessionSchema, insertWordSchema, insertCombatLogSchema } from "@shared/schema";
import { z } from "zod";

interface WebSocketMessage {
  type: string;
  sessionId?: number;
  data?: any;
}

// WebSocket server for real-time updates
let wss: WebSocketServer;
const sessionConnections = new Map<number, Set<WebSocket>>();

// Generate session code
function generateSessionCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Generate random player name
function generateRandomPlayerName(): string {
  const adjectives = ['Swift', 'Brave', 'Mystic', 'Shadow', 'Golden', 'Silver', 'Crimson', 'Azure', 'Emerald', 'Violet'];
  const nouns = ['Warrior', 'Mage', 'Rogue', 'Knight', 'Archer', 'Druid', 'Wizard', 'Paladin', 'Ranger', 'Monk'];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adjective} ${noun}`;
}

// Generate unique user ID
function generateUserId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Generate unique email
function generateEmail(): string {
  const adjectives = ['swift', 'brave', 'mystic', 'shadow', 'golden', 'silver', 'crimson', 'azure', 'emerald', 'violet'];
  const nouns = ['warrior', 'mage', 'rogue', 'knight', 'archer', 'druid', 'wizard', 'paladin', 'ranger', 'monk'];
  const numbers = Math.floor(Math.random() * 1000);
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adjective}.${noun}${numbers}@adventure.com`;
}

// Generate unique name
function generateName(): { firstName: string; lastName: string } {
  const firstNames = ['Aria', 'Thorne', 'Kael', 'Lyra', 'Raven', 'Zephyr', 'Nova', 'Orion', 'Sage', 'Vex'];
  const lastNames = ['Stormwind', 'Shadowbane', 'Fireheart', 'Moonwhisper', 'Starweaver', 'Darkforge', 'Lightbringer', 'Nightshade', 'Dawnseeker', 'Frostborn'];
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  return { firstName, lastName };
}

// Create a unique user
async function createUniqueUser() {
  const userId = generateUserId();
  const email = generateEmail();
  const { firstName, lastName } = generateName();
  
  return await storage.upsertUser({
    id: userId,
    email,
    firstName,
    lastName,
    profileImageUrl: null,
  });
}

function broadcastToSession(sessionId: number, message: WebSocketMessage) {
  const clients = sessionConnections.get(sessionId);
  if (clients) {
    const messageStr = JSON.stringify(message);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Game session routes
  app.post('/api/sessions', async (req, res) => {
    try {
      // Create a unique GM user
      const gmUser = await createUniqueUser();
      
      const sessionData = insertGameSessionSchema.parse({
        ...req.body,
        code: generateSessionCode(),
        gmId: gmUser.id,
      });
      
      const session = await storage.createGameSession(sessionData);
      
      res.json({ session, user: gmUser });
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.post('/api/sessions/join', async (req, res) => {
    try {
      // Create a unique player user
      const playerUser = await createUniqueUser();
      
      const { code } = z.object({ code: z.string() }).parse(req.body);
      
      const session = await storage.getGameSessionByCode(code);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      const existingPlayer = await storage.getPlayerInSession(session.id, playerUser.id);
      if (existingPlayer) {
        return res.json({ session, player: existingPlayer, user: playerUser });
      }

      const players = await storage.getSessionPlayers(session.id);
      if (players.length >= 5) {
        return res.status(400).json({ message: "Session is full" });
      }

      // Generate a random player name
      const playerName = generateRandomPlayerName();
      
      // Create a new player with the random name
      const player = await storage.joinSession({
        sessionId: session.id,
        userId: playerUser.id,
        nerve: 8,
        maxNerve: 8,
        turnOrder: players.length,
        playerName: playerName, // Add the random name
      });

      // Handle turn order based on when they join
      if (players.length === 0) {
        // First player (after GM) - recalculate turn order and set them as active
        await storage.recalculateTurnOrder(session.id);
        await storage.setActiveTurn(session.id, playerUser.id);
      } else {
        // Subsequent players - add them to the end of turn order
        await storage.addPlayerToTurnOrder(session.id, playerUser.id);
      }

      // Broadcast player joined
      broadcastToSession(session.id, {
        type: 'player_joined',
        data: { player }
      });

      res.json({ session, player, user: playerUser });
    } catch (error) {
      console.error("Error joining session:", error);
      res.status(500).json({ message: "Failed to join session" });
    }
  });

  app.get('/api/sessions/:id', async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getGameSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      const players = await storage.getSessionPlayers(sessionId);
      const words = await storage.getSessionWords(sessionId);
      const combatLog = await storage.getCombatLog(sessionId);

      // Return session data with properties at the top level
      res.json({
        id: session.id,
        code: session.code,
        name: session.name,
        gmId: session.gmId,
        encounterSentence: session.encounterSentence,
        currentTurn: session.currentTurn,
        isActive: session.isActive,
        createdAt: session.createdAt,
        players,
        words,
        combatLog
      });
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  // Word management - Players can define words, GM sets potency
  app.post('/api/sessions/:id/words', async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { userId, word, meaning } = req.body;
      
      if (!userId || !word || !meaning) {
        return res.status(400).json({ message: "User ID, word, and meaning are required" });
      }
      
      // Check if session exists
      const session = await storage.getGameSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // Check if user is a player in this session
      const player = await storage.getPlayerInSession(sessionId, userId);
      if (!player) {
        return res.status(403).json({ message: "You must be a player in this session to create words" });
      }
      
      // Check if it's the player's turn (use isActiveTurn if set, otherwise highest nerve goes first)
      const players = await storage.getSessionPlayers(sessionId);
      const activePlayer = players.find(p => p.isActiveTurn) || 
        (players.length > 0 
          ? players.reduce((prev, current) => 
              (prev?.nerve || 0) > (current?.nerve || 0) ? prev : current
            )
          : null);
      
      if (!activePlayer || activePlayer.userId !== userId) {
        return res.status(403).json({ message: "Only the active player can create words" });
      }
      
      // Create word without potency (pending GM approval)
      const wordData = {
        sessionId,
        word,
        meaning,
        potency: null, // GM will set this
        ownerId: userId,
        isApproved: false,
      };
      
      const newWord = await storage.createWord(wordData);
      
      // Broadcast new pending word
      broadcastToSession(sessionId, {
        type: 'word_created',
        data: { word: newWord }
      });
      
      res.json(newWord);
    } catch (error) {
      console.error("Error creating word:", error);
      res.status(500).json({ message: "Failed to create word" });
    }
  });

  // GM approves word and sets potency
  app.post('/api/sessions/:id/words/:wordId/approve', async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const wordId = parseInt(req.params.wordId);
      const { userId, potency } = req.body;
      
      if (!userId || potency === undefined) {
        return res.status(400).json({ message: "User ID and potency are required" });
      }
      
      // Check if user is the GM of this session
      const session = await storage.getGameSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      if (session.gmId !== userId) {
        return res.status(403).json({ message: "Only the Game Master can approve words" });
      }
      
      // Approve the word with potency
      const approvedWord = await storage.approveWord(wordId, potency);
      
      // Broadcast word approval
      broadcastToSession(sessionId, {
        type: 'word_approved',
        data: { word: approvedWord }
      });
      
      res.json(approvedWord);
    } catch (error) {
      console.error("Error approving word:", error);
      res.status(500).json({ message: "Failed to approve word" });
    }
  });

  // Get pending words (for GM to review)
  app.get('/api/sessions/:id/words/pending', async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      // Check if user is the GM of this session
      const session = await storage.getGameSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      if (session.gmId !== userId) {
        return res.status(403).json({ message: "Only the Game Master can view pending words" });
      }
      
      const pendingWords = await storage.getPendingWords(sessionId);
      res.json(pendingWords);
    } catch (error) {
      console.error("Error fetching pending words:", error);
      res.status(500).json({ message: "Failed to fetch pending words" });
    }
  });

  // Combat actions
  app.post('/api/sessions/:id/combat', async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { userId } = req.body; // Get userId from request body
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      const combatData = insertCombatLogSchema.parse({
        ...req.body,
        sessionId,
        playerId: userId,
      });
      
      const entry = await storage.addCombatLogEntry(combatData);
      
      // Broadcast combat action
      broadcastToSession(sessionId, {
        type: 'combat_action',
        data: { entry }
      });
      
      res.json(entry);
    } catch (error) {
      console.error("Error adding combat action:", error);
      res.status(500).json({ message: "Failed to add combat action" });
    }
  });

  // Nerve updates (GM only)
  app.patch('/api/sessions/:id/players/:targetUserId/nerve', async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { userId } = req.body; // Get GM userId from request body
      const targetUserId = req.params.targetUserId;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      // Check if user is the GM of this session
      const session = await storage.getGameSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      if (session.gmId !== userId) {
        return res.status(403).json({ message: "Only the Game Master can adjust player nerve" });
      }
      
      const { nerve } = z.object({ nerve: z.number().min(0).max(8) }).parse(req.body);
      
      await storage.updatePlayerNerve(sessionId, targetUserId, nerve);
      
      // Broadcast nerve update
      broadcastToSession(sessionId, {
        type: 'nerve_updated',
        data: { userId: targetUserId, nerve }
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating nerve:", error);
      res.status(500).json({ message: "Failed to update nerve" });
    }
  });

  // Encounter updates (GM only)
  app.patch('/api/sessions/:id/encounter', async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { userId } = req.body; // Get GM userId from request body
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      // Check if user is the GM of this session
      const session = await storage.getGameSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      if (session.gmId !== userId) {
        return res.status(403).json({ message: "Only the Game Master can update encounters" });
      }
      
      const { sentence } = z.object({ sentence: z.string() }).parse(req.body);
      
      // Check if this is a new encounter (different from current)
      const isNewEncounter = session.encounterSentence !== sentence;
      
      await storage.updateEncounterSentence(sessionId, sentence);
      
      // If this is a new encounter, reset turns and clear pending words
      if (isNewEncounter) {
        await storage.resetTurnsForNewEncounter(sessionId);
        
        // Recalculate turn order for the new encounter
        await storage.recalculateTurnOrder(sessionId);
        
        // Set the first player in the new order as active
        const players = await storage.getSessionPlayers(sessionId);
        const firstPlayer = players.find(p => p.turnOrder === 0);
        if (firstPlayer) {
          await storage.setActiveTurn(sessionId, firstPlayer.userId);
        }
        
        // Clear pending words for the new encounter
        const pendingWords = await storage.getPendingWords(sessionId);
        for (const word of pendingWords) {
          await storage.deleteWord(word.id);
        }
      }
      
      // Broadcast encounter update
      broadcastToSession(sessionId, {
        type: 'encounter_updated',
        data: { 
          sentence,
          isNewEncounter,
          currentTurn: isNewEncounter ? 1 : session.currentTurn
        }
      });
      
      res.json({ success: true, isNewEncounter });
    } catch (error) {
      console.error("Error updating encounter:", error);
      res.status(500).json({ message: "Failed to update encounter" });
    }
  });

  // GM advances to next player in turn order
  app.post('/api/sessions/:id/turn/next', async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      // Check if user is the GM of this session
      const session = await storage.getGameSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      if (session.gmId !== userId) {
        return res.status(403).json({ message: "Only the Game Master can advance turns" });
      }
      
      // Advance to next player
      const result = await storage.advanceToNextPlayer(sessionId);
      
      // Get the updated session to get the current turn
      const updatedSession = await storage.getGameSession(sessionId);
      
      // Broadcast turn advancement
      broadcastToSession(sessionId, {
        type: 'turn_advanced',
        data: { 
          nextPlayerId: result.nextPlayerId, 
          turnIncremented: result.turnIncremented,
          currentTurn: updatedSession?.currentTurn || 1
        }
      });
      
      res.json({ 
        success: true, 
        nextPlayerId: result.nextPlayerId, 
        turnIncremented: result.turnIncremented,
        currentTurn: updatedSession?.currentTurn || 1
      });
    } catch (error) {
      console.error("Error advancing turn:", error);
      res.status(500).json({ message: "Failed to advance turn" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    console.log('WebSocket client connected:', req.socket.remoteAddress);
    
    ws.on('message', (data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        console.log('Received WebSocket message:', message);
        
        if (message.type === 'join_session' && message.sessionId) {
          const sessionId = message.sessionId;
          console.log('Client joining session:', sessionId);
          
          if (!sessionConnections.has(sessionId)) {
            sessionConnections.set(sessionId, new Set());
          }
          
          sessionConnections.get(sessionId)!.add(ws);
          console.log('Client added to session:', sessionId);
          
          ws.on('close', () => {
            console.log('Client disconnected from session:', sessionId);
            sessionConnections.get(sessionId)?.delete(ws);
          });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    ws.on('close', (code, reason) => {
      console.log('WebSocket client disconnected:', code, reason?.toString());
    });
  });

  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  return httpServer;
}
