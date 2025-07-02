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
    console.log(`[broadcastToSession] Sending message to session ${sessionId} (${clients.size} clients):`, message.type);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  } else {
    console.log(`[broadcastToSession] No clients found for session ${sessionId}`);
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
      // Add GM as a pseudo-player if not present
      let gmUser = null;
      if (session.gmId && !players.some(p => p.userId === session.gmId)) {
        gmUser = await storage.getUser(session.gmId);
        players.push({
          userId: session.gmId,
          playerName: gmUser?.firstName || gmUser?.email || 'Game Master',
          nerve: null,
          maxNerve: null,
          turnOrder: null,
          isActive: null,
          isActiveTurn: null,
          joinedAt: null,
          id: -1, // Use -1 or a special value for pseudo-player
          sessionId: sessionId
        });
      }
      const words = await storage.getSessionWords(sessionId);
      const combatLog = await storage.getCombatLog(sessionId);

      // Get owners for each word
      const wordsWithOwners = await Promise.all(
        words.map(async (word) => {
          const owners = await storage.getWordOwners(word.id);
          return { ...word, owners };
        })
      );

      // Return session data with properties at the top level
      res.json({
        id: session.id,
        code: session.code,
        name: session.name,
        gmId: session.gmId,
        encounterSentence: session.encounterSentence,
        encounterNoun: session.encounterNoun,
        encounterVerb: session.encounterVerb,
        encounterAdjective: session.encounterAdjective,
        encounterThreat: session.encounterThreat,
        encounterDifficulty: session.encounterDifficulty,
        encounterLength: session.encounterLength,
        isPrepTurn: session.isPrepTurn,
        currentPrepWordIndex: session.currentPrepWordIndex,
        vowels: session.vowels,
        currentTurn: session.currentTurn,
        isActive: session.isActive,
        createdAt: session.createdAt,
        players,
        words: wordsWithOwners,
        combatLog
      });
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  // Get session words with owners
  app.get("/api/sessions/:sessionId/words", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      console.log(`[GET /api/sessions/${sessionId}/words] Called`);
      const words = await storage.getSessionWords(sessionId);
      console.log(`[GET /api/sessions/${sessionId}/words] Found ${words.length} words:`, words);
      
      // Get owners for each word
      const wordsWithOwners = await Promise.all(
        words.map(async (word) => {
          const owners = await storage.getWordOwners(word.id);
          return { ...word, owners };
        })
      );
      
      console.log(`[GET /api/sessions/${sessionId}/words] Returning ${wordsWithOwners.length} words with owners`);
      res.json(wordsWithOwners);
    } catch (error) {
      console.error("Error fetching session words:", error);
      res.status(500).json({ message: "Failed to fetch session words" });
    }
  });

  // Word management - Players can define words, GM sets potency
  app.post('/api/sessions/:sessionId/words', async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const { word, meaning, userId, category } = req.body;

      if (!word || !userId) {
        return res.status(400).json({ message: "Word and userId are required" });
      }

      // Check if word already exists in this session
      const existingWord = await storage.findWordByText(sessionId, word);
      
      if (existingWord) {
        // Word already exists, add current user as an owner
        await storage.addWordOwner(existingWord.id, userId);

        // Broadcast updated word ownership to all clients in the session
        const owners = await storage.getWordOwners(existingWord.id);
        broadcastToSession(sessionId, {
          type: 'word_ownership_updated',
          data: { word: { ...existingWord, owners } }
        });

        res.json({ 
          message: "You are now an owner of this existing word",
          word: existingWord,
          isExisting: true 
        });
      } else {
        // Create new word - meaning is required for new words
        if (!meaning) {
          return res.status(400).json({ message: "Meaning is required for new words" });
        }

        const newWord = await storage.createWord({
          sessionId,
          word,
          meaning,
          category: category || "noun",
          potency: null,
          isApproved: false,
        });
        
        // Add the creator as the first owner
        await storage.addWordOwner(newWord.id, userId);
        
        // Broadcast new word creation to all clients in the session
        const owners = await storage.getWordOwners(newWord.id);
        broadcastToSession(sessionId, {
          type: 'word_created',
          data: { word: { ...newWord, owners } }
        });
        
        res.json({ 
          message: "Word created successfully",
          word: newWord,
          isExisting: false 
        });
      }
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
      
      // Validate potency range
      if (!Number.isInteger(potency) || potency < -2 || potency > 2) {
        return res.status(400).json({ message: "Potency must be between -2 and 2 (whole numbers only)" });
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
      
      // Get word owners and adjust their nerve based on potency
      const wordOwners = await storage.getWordOwners(wordId);
      
      for (const ownerId of wordOwners) {
        // Get current player nerve
        const player = await storage.getPlayerInSession(sessionId, ownerId);
        if (player) {
          let newNerve = player.nerve || 0;
          
          // Adjust nerve based on potency
          // Positive potency reduces nerve (negative effect)
          // Negative potency increases nerve (positive effect)
          if (potency > 0) {
            newNerve = Math.max(1, newNerve - potency); // Reduce nerve, minimum 1
          } else if (potency < 0) {
            newNerve = Math.min(8, newNerve + Math.abs(potency)); // Increase nerve, maximum 8
          }
          
          // Update player nerve
          await storage.updatePlayerNerve(sessionId, ownerId, newNerve);
          
          // Broadcast nerve update for each affected player
          broadcastToSession(sessionId, {
            type: 'nerve_updated',
            data: { userId: ownerId, nerve: newNerve }
          });
        }
      }
      
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

  // Get pending words for GM approval
  app.get("/api/sessions/:sessionId/words/pending", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const pendingWords = await storage.getPendingWords(sessionId);
      
      // Get owners for each pending word
      const pendingWordsWithOwners = await Promise.all(
        pendingWords.map(async (word) => {
          const owners = await storage.getWordOwners(word.id);
          return { ...word, owners };
        })
      );
      
      res.json(pendingWordsWithOwners);
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
      
      const { sentence, threat, difficulty, length, noun, verb, adjective } = z.object({ 
        sentence: z.string().optional(),
        threat: z.string().optional(),
        difficulty: z.string().optional(),
        length: z.string().optional(),
        noun: z.string().optional(),
        verb: z.string().optional(),
        adjective: z.string().optional(),
      }).parse(req.body);
      
      // Convert string values to numbers, defaulting to 1 if invalid
      const threatNum = threat ? parseInt(threat) || 1 : undefined;
      const difficultyNum = difficulty ? parseInt(difficulty) || 1 : undefined;
      const lengthNum = length ? parseInt(length) || 1 : undefined;
      
      // Check if this is a new encounter (different from current)
      const isNewEncounter = session.encounterSentence !== sentence || 
                            (session.encounterSentence === null && sentence) ||
                            (session.encounterNoun !== noun) ||
                            (session.encounterVerb !== verb) ||
                            (session.encounterAdjective !== adjective);
      
      console.log('Encounter update debug:', {
        currentSentence: session.encounterSentence,
        newSentence: sentence,
        currentNoun: session.encounterNoun,
        newNoun: noun,
        currentVerb: session.encounterVerb,
        newVerb: verb,
        currentAdjective: session.encounterAdjective,
        newAdjective: adjective,
        isNewEncounter
      });
      
      // Calculate new stats
      const newThreat = Math.max(1, Math.min(10, (session.encounterThreat || 1) + (threatNum || 0)));
      const newDifficulty = Math.max(1, Math.min(10, (session.encounterDifficulty || 1) + (difficultyNum || 0)));
      const newLength = Math.max(1, Math.min(10, (session.encounterLength || 1) + (lengthNum || 0)));
      
      // If this is a new encounter, reset turns and clear pending words
      if (isNewEncounter) {
        console.log('Creating new encounter with prep turn...');
        await storage.resetTurnsForNewEncounter(sessionId);
        
        // Add generated encounter words to the dictionary
        if (noun) {
          console.log('Adding noun to dictionary:', noun);
          try {
            const createdWord = await storage.createWord({
              sessionId,
              word: noun,
              meaning: "GM generated encounter noun",
              category: "noun",
              isApproved: true,
              potency: null, // Will be set during prep turn
            });
            console.log('Successfully created noun word:', createdWord);
            
            // Immediately verify the word was stored
            const verifyWords = await storage.getSessionWords(sessionId);
            console.log(`Verification: Found ${verifyWords.length} words in session ${sessionId}:`, verifyWords);
          } catch (error) {
            console.error('Error creating noun word:', error);
          }
        }
        if (verb) {
          console.log('Adding verb to dictionary:', verb);
          try {
            const createdWord = await storage.createWord({
              sessionId,
              word: verb,
              meaning: "GM generated encounter verb", 
              category: "verb",
              isApproved: true,
              potency: null, // Will be set during prep turn
            });
            console.log('Successfully created verb word:', createdWord);
            
            // Immediately verify the word was stored
            const verifyWords = await storage.getSessionWords(sessionId);
            console.log(`Verification: Found ${verifyWords.length} words in session ${sessionId}:`, verifyWords);
          } catch (error) {
            console.error('Error creating verb word:', error);
          }
        }
        if (adjective) {
          console.log('Adding adjective to dictionary:', adjective);
          try {
            const createdWord = await storage.createWord({
              sessionId,
              word: adjective,
              meaning: "GM generated encounter adjective",
              category: "adjective", 
              isApproved: true,
              potency: null, // Will be set during prep turn
            });
            console.log('Successfully created adjective word:', createdWord);
            
            // Immediately verify the word was stored
            const verifyWords = await storage.getSessionWords(sessionId);
            console.log(`Verification: Found ${verifyWords.length} words in session ${sessionId}:`, verifyWords);
          } catch (error) {
            console.error('Error creating adjective word:', error);
          }
        }
        
        // Start prep turn and set all encounter fields directly
        console.log('Starting prep turn...');
        await storage.updateEncounter(sessionId, {
          sentence: sentence || "",
          threat: threatNum || 1,
          difficulty: difficultyNum || 1,
          length: lengthNum || 1,
          noun: noun,
          verb: verb,
          adjective: adjective,
          isPrepTurn: true,
          currentPrepWordIndex: 0, // Start with noun
        });
        
        // Recalculate turn order for the new encounter
        await storage.recalculateTurnOrder(sessionId);
        
        // Set the first player in the new order as active
        const players = await storage.getSessionPlayers(sessionId);
        const firstPlayer = players.find(p => p.turnOrder === 0);
        if (firstPlayer) {
          console.log('Setting first player as active:', firstPlayer.userId);
          await storage.setActiveTurn(sessionId, firstPlayer.userId);
        }
        
        // Clear pending words for the new encounter
        const pendingWords = await storage.getPendingWords(sessionId);
        for (const word of pendingWords) {
          await storage.deleteWord(word.id);
        }
      } else {
        // For existing encounters, keep the increment logic
        await storage.updateEncounter(sessionId, {
          sentence: sentence || "",
          threat: newThreat,
          difficulty: newDifficulty,
          length: newLength,
          noun: noun,
          verb: verb,
          adjective: adjective,
        });
      }
      
      // Reload session from storage to get the latest state
      const updatedSession = await storage.getGameSession(sessionId);
      
      // Broadcast encounter update
      broadcastToSession(sessionId, {
        type: 'encounter_updated',
        data: { 
          sentence: updatedSession?.encounterSentence,
          noun: updatedSession?.encounterNoun,
          verb: updatedSession?.encounterVerb,
          adjective: updatedSession?.encounterAdjective,
          threat: updatedSession?.encounterThreat,
          difficulty: updatedSession?.encounterDifficulty,
          length: updatedSession?.encounterLength,
          isNewEncounter,
          isPrepTurn: updatedSession?.isPrepTurn,
          currentPrepWordIndex: updatedSession?.currentPrepWordIndex,
          currentTurn: updatedSession?.currentTurn
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

  // Update session vowels (GM only)
  app.patch('/api/sessions/:id/vowels', async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { userId, vowels } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      // Check if user is the GM of this session
      const session = await storage.getGameSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      if (session.gmId !== userId) {
        return res.status(403).json({ message: "Only the Game Master can update vowels" });
      }
      
      const { vowels: newVowels } = z.object({ 
        vowels: z.array(z.string()).length(6)
      }).parse(req.body);
      
      await storage.updateSessionVowels(sessionId, newVowels);
      
      // Broadcast vowels update
      broadcastToSession(sessionId, {
        type: 'vowels_updated',
        data: { vowels: newVowels }
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating vowels:", error);
      res.status(500).json({ message: "Failed to update vowels" });
    }
  });

  // Define encounter word meaning during prep turn (store temporarily)
  app.post('/api/sessions/:id/prep/define-word', async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { word, meaning, userId } = req.body;

      if (!word || !meaning || !userId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Store the word meaning in the session's prepWordMeanings (not the dictionary)
      await storage.setPrepWordMeaning(sessionId, word, meaning);

      // Broadcast the prep_word_meaning_defined event to all clients
      broadcastToSession(sessionId, {
        type: 'prep_word_meaning_defined',
        data: { word, meaning, userId }
      });

      res.json({ message: "Word meaning stored for prep phase" });
    } catch (error) {
      console.error("Error defining word:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Set potency for encounter word
  app.post('/api/sessions/:id/prep/set-potency', async (req, res) => {
    console.log('[DEBUG][ENDPOINT] set-potency called with:', req.body);
    try {
      const sessionId = parseInt(req.params.id);
      const { word, potency, meaning, userId } = req.body;

      if (!word || potency === undefined || !userId || !meaning) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check if user is the GM of this session
      const session = await storage.getGameSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      if (session.gmId !== userId) {
        return res.status(403).json({ message: "Only the Game Master can set potency" });
      }

      // Check if the word already exists in the dictionary
      let wordObj = await storage.findWordByText(sessionId, word);
      if (!wordObj) {
        // Create the word with meaning and potency
        wordObj = await storage.createWord({
          word,
          sessionId,
          meaning,
          potency,
          category: 'noun', // or determine based on context
          isApproved: true,
        });
      } else {
        // If the word exists, update its meaning and potency
        await storage.updateWordMeaning(word, meaning, sessionId);
        await storage.updateWordPotency(word, potency, sessionId);
        wordObj = await storage.findWordByText(sessionId, word);
      }

      if (!wordObj) {
        throw new Error('wordObj is undefined after setting potency');
      }

      // Always include potency, even if 0 or null
      const broadcastWord = {
        word: wordObj.word,
        potency: wordObj.potency ?? 0,
        meaning: wordObj.meaning,
        gmId: session.gmId,
      };
      console.log('[DEBUG][BROADCAST] word_defined:', broadcastWord);
      broadcastToSession(sessionId, {
        type: 'word_defined',
        data: {
          word: broadcastWord,
          userId
        }
      });

      res.json({ message: "Potency set and word saved to dictionary", word: wordObj });
    } catch (error) {
      console.error("Error setting potency:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Modify encounter stats based on potency
  app.post('/api/sessions/:id/prep/modify-stats', async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Get current session
      const session = await storage.getGameSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Get the current word being defined
      let currentWord = null;
      switch (session.currentPrepWordIndex) {
        case 0:
          currentWord = session.encounterNoun;
          break;
        case 1:
          currentWord = session.encounterVerb;
          break;
        case 2:
          currentWord = session.encounterAdjective;
          break;
      }

      if (!currentWord) {
        return res.status(400).json({ message: "No current word to modify stats for" });
      }

      // Find the word in the dictionary and check if potency is set
      const wordInDictionary = await storage.findWordByText(sessionId, currentWord);
      if (!wordInDictionary) {
        return res.status(400).json({ message: "Current word not found in dictionary" });
      }

      if (wordInDictionary.potency === null || wordInDictionary.potency === undefined) {
        return res.status(400).json({ 
          message: "GM must set potency for the current word before stats can be modified",
          currentWord,
          wordId: wordInDictionary.id
        });
      }

      // Use the word's potency as the modification value
      const potency = wordInDictionary.potency;
      console.log(`Modifying stats with potency ${potency} for word ${currentWord}`);

      // Calculate new stats using the potency value
      const newThreat = Math.max(1, Math.min(10, (session.encounterThreat || 1) + potency));
      const newDifficulty = Math.max(1, Math.min(10, (session.encounterDifficulty || 1) + potency));
      const newLength = Math.max(1, Math.min(10, (session.encounterLength || 1) + potency));

      // Update encounter stats
      await storage.updateEncounter(sessionId, {
        sentence: session.encounterSentence || "",
        threat: newThreat,
        difficulty: newDifficulty,
        length: newLength,
      });
      
      // Broadcast the stat modifications
      broadcastToSession(sessionId, {
        type: 'stats_modified',
        data: { 
          threat: newThreat,
          difficulty: newDifficulty,
          length: newLength,
          potency,
          currentWord,
          userId 
        }
      });

      res.json({ 
        message: "Stats modified successfully",
        threat: newThreat,
        difficulty: newDifficulty,
        length: newLength,
        potency,
        currentWord
      });
    } catch (error) {
      console.error("Error modifying stats:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Advance prep turn to next word
  app.post('/api/sessions/:id/prep/next-word', async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Get current session
      const session = await storage.getGameSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Get all players in the session, sorted by turn order
      const players = await storage.getSessionPlayers(sessionId);
      const numPlayers = players.length;
      if (numPlayers === 0) {
        return res.status(400).json({ message: "No players in session" });
      }

      // Track how many turns have been taken for the current word
      // We'll use session.currentPrepWordTurnCount (add to schema if needed)
      let currentPrepWordTurnCount = session.currentPrepWordTurnCount || 0;
      let currentPrepWordIndex = session.currentPrepWordIndex || 0;
      let isPrepTurn = true;

      currentPrepWordTurnCount++;

      // If all players have taken a turn for this word, advance to next word
      if (currentPrepWordTurnCount >= numPlayers) {
        currentPrepWordTurnCount = 0;
        currentPrepWordIndex++;
      }

      // If we've defined all words, end prep turn
      if (currentPrepWordIndex >= 3) {
        currentPrepWordIndex = 0;
        isPrepTurn = false;
      }

      // Update prep turn state
      await storage.updateEncounter(sessionId, {
        sentence: session.encounterSentence || "",
        currentPrepWordIndex,
        isPrepTurn,
        currentPrepWordTurnCount,
      });
      
      // If we're still in prep turn, advance to next player
      if (isPrepTurn) {
        const result = await storage.advanceToNextPlayer(sessionId);
        
        // Broadcast the prep turn advancement
        broadcastToSession(sessionId, {
          type: 'prep_turn_advanced',
          data: { 
            currentPrepWordIndex,
            isPrepTurn,
            nextPlayerId: result.nextPlayerId,
            userId 
          }
        });
      } else {
        // End prep turn - start normal game
        const players = await storage.getSessionPlayers(sessionId);
        const firstPlayer = players.find(p => p.turnOrder === 0);
        if (firstPlayer) {
          await storage.setActiveTurn(sessionId, firstPlayer.userId);
        }
        
        // Broadcast the prep turn advancement
        broadcastToSession(sessionId, {
          type: 'prep_turn_advanced',
          data: { 
            currentPrepWordIndex,
            isPrepTurn,
            nextPlayerId: firstPlayer?.userId,
            userId 
          }
        });
      }

      res.json({ 
        message: "Prep turn advanced",
        currentPrepWordIndex,
        isPrepTurn,
        currentPrepWordTurnCount,
      });
    } catch (error) {
      console.error("Error advancing prep turn:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Adjust a single encounter stat after word definition and potency
  app.post('/api/sessions/:id/prep/adjust-encounter-stat', async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { stat, userId, meaning, potency } = req.body;
      if (!stat || !userId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Get current session
      const session = await storage.getGameSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Get the current word being defined
      let currentWord = null;
      let wordCategory = 'noun';
      switch (session.currentPrepWordIndex) {
        case 0:
          currentWord = session.encounterNoun;
          wordCategory = 'noun';
          break;
        case 1:
          currentWord = session.encounterVerb;
          wordCategory = 'verb';
          break;
        case 2:
          currentWord = session.encounterAdjective;
          wordCategory = 'adjective';
          break;
      }
      if (!currentWord) {
        return res.status(400).json({ message: "No current word to adjust" });
      }

      // Check if the word is already in the dictionary
      let wordInDictionary = await storage.findWordByText(sessionId, currentWord);
      if (!wordInDictionary) {
        // If not, create it with provided meaning and potency
        if (!meaning || typeof potency !== 'number') {
          return res.status(400).json({ message: "Missing meaning or potency for new word" });
        }
        wordInDictionary = await storage.createWord({
          word: currentWord,
          sessionId,
          meaning,
          category: wordCategory,
          potency,
          isApproved: true,
        });
      }
      // Always set the GM as the owner (even if the word already existed)
      if (session.gmId) {
        await storage.addWordOwner(wordInDictionary.id, session.gmId);
      }

      // Use the word's potency as the adjustment value
      const adjustment = wordInDictionary.potency || 0;
      let newThreat = session.encounterThreat || 1;
      let newDifficulty = session.encounterDifficulty || 1;
      let newLength = session.encounterLength || 1;
      if (stat === 'threat') {
        newThreat = Math.max(1, Math.min(10, newThreat + adjustment));
      } else if (stat === 'difficulty') {
        newDifficulty = Math.max(1, Math.min(10, newDifficulty + adjustment));
      } else if (stat === 'length') {
        newLength = Math.max(1, Math.min(10, newLength + adjustment));
      } else {
        return res.status(400).json({ message: "Invalid stat to adjust" });
      }

      // Update encounter stats
      await storage.updateEncounter(sessionId, {
        sentence: session.encounterSentence || "",
        threat: newThreat,
        difficulty: newDifficulty,
        length: newLength,
      });

      // Broadcast the stat adjustment
      broadcastToSession(sessionId, {
        type: 'stat_adjusted',
        data: {
          stat,
          value: adjustment,
          newThreat,
          newDifficulty,
          newLength,
          word: currentWord,
          userId,
        }
      });

      res.json({
        message: `Adjusted ${stat} by ${adjustment}`,
        threat: newThreat,
        difficulty: newDifficulty,
        length: newLength,
        word: currentWord,
      });
    } catch (error) {
      console.error("Error adjusting encounter stat:", error);
      res.status(500).json({ message: "Internal server error" });
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
          console.log('[WebSocket] Client joining session:', sessionId);
          
          if (!sessionConnections.has(sessionId)) {
            sessionConnections.set(sessionId, new Set());
            console.log('[WebSocket] Created new session connection set for session:', sessionId);
          }
          
          sessionConnections.get(sessionId)!.add(ws);
          console.log('[WebSocket] Client added to session:', sessionId, 'Total clients in session:', sessionConnections.get(sessionId)!.size);
          
          ws.on('close', () => {
            console.log('[WebSocket] Client disconnected from session:', sessionId);
            sessionConnections.get(sessionId)?.delete(ws);
            console.log('[WebSocket] Remaining clients in session:', sessionId, ':', sessionConnections.get(sessionId)?.size || 0);
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
