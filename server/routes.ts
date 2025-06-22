import type { Express } from "express";
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

const sessionClients = new Map<number, Set<WebSocket>>();

function generateSessionCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function broadcastToSession(sessionId: number, message: WebSocketMessage) {
  const clients = sessionClients.get(sessionId);
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
  app.post('/api/sessions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const sessionData = insertGameSessionSchema.parse({
        ...req.body,
        code: generateSessionCode(),
        gmId: userId,
      });
      
      const session = await storage.createGameSession(sessionData);
      
      // Auto-join GM to session
      await storage.joinSession({
        sessionId: session.id,
        userId,
        nerve: 8,
        maxNerve: 8,
        turnOrder: 0,
      });
      
      res.json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.post('/api/sessions/join', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { code } = z.object({ code: z.string() }).parse(req.body);
      
      const session = await storage.getGameSessionByCode(code);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      const existingPlayer = await storage.getPlayerInSession(session.id, userId);
      if (existingPlayer) {
        return res.json({ session, player: existingPlayer });
      }

      const players = await storage.getSessionPlayers(session.id);
      if (players.length >= 5) {
        return res.status(400).json({ message: "Session is full" });
      }

      const player = await storage.joinSession({
        sessionId: session.id,
        userId,
        nerve: 8,
        maxNerve: 8,
        turnOrder: players.length,
      });

      // Broadcast player joined
      broadcastToSession(session.id, {
        type: 'player_joined',
        data: { player }
      });

      res.json({ session, player });
    } catch (error) {
      console.error("Error joining session:", error);
      res.status(500).json({ message: "Failed to join session" });
    }
  });

  app.get('/api/sessions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getGameSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      const players = await storage.getSessionPlayers(sessionId);
      const words = await storage.getSessionWords(sessionId);
      const combatLog = await storage.getCombatLog(sessionId);

      res.json({ session, players, words, combatLog });
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  // Word management
  app.post('/api/sessions/:id/words', isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const userId = req.user.id;
      
      const wordData = insertWordSchema.parse({
        ...req.body,
        sessionId,
        ownerId: userId,
      });
      
      const word = await storage.createWord(wordData);
      
      // Broadcast new word
      broadcastToSession(sessionId, {
        type: 'word_created',
        data: { word }
      });
      
      res.json(word);
    } catch (error) {
      console.error("Error creating word:", error);
      res.status(500).json({ message: "Failed to create word" });
    }
  });

  // Combat actions
  app.post('/api/sessions/:id/combat', isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const userId = req.user.id;
      
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

  // Nerve updates
  app.patch('/api/sessions/:id/players/:userId/nerve', isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const targetUserId = req.params.userId;
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

  // Encounter updates
  app.patch('/api/sessions/:id/encounter', isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { sentence } = z.object({ sentence: z.string() }).parse(req.body);
      
      await storage.updateEncounterSentence(sessionId, sentence);
      
      // Broadcast encounter update
      broadcastToSession(sessionId, {
        type: 'encounter_updated',
        data: { sentence }
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating encounter:", error);
      res.status(500).json({ message: "Failed to update encounter" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        
        if (message.type === 'join_session' && message.sessionId) {
          const sessionId = message.sessionId;
          
          if (!sessionClients.has(sessionId)) {
            sessionClients.set(sessionId, new Set());
          }
          
          sessionClients.get(sessionId)!.add(ws);
          
          ws.on('close', () => {
            sessionClients.get(sessionId)?.delete(ws);
          });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
  });

  return httpServer;
}
