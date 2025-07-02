import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";
import AppHeader from "@/components/AppHeader";
import EncounterHeader from "@/components/EncounterHeader";
import PlayerPanel from "@/components/PlayerPanel";
import WordDictionary from "@/components/WordDictionary";
import GameMasterPanel from "@/components/GameMasterPanel";
import PrepTurnPanel from "@/components/PrepTurnPanel";
import DiceRoller from "@/components/DiceRoller";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Users, Crown } from "lucide-react";

interface PlayerData {
  id: number;
  sessionId: number;
  userId: string;
  nerve: number;
  maxNerve: number;
  turnOrder: number;
  playerName: string;
  isActive: boolean;
  isActiveTurn: boolean;
  joinedAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface WordData {
  id: number;
  sessionId: number;
  word: string;
  meaning: string;
  potency: number | null;
  ownerId: string;
  isApproved: boolean;
  createdAt: string;
}

interface SessionData {
  id: number;
  code: string;
  name: string;
  gmId: string;
  encounterSentence: string | null;
  encounterNoun: string | null;
  encounterVerb: string | null;
  encounterAdjective: string | null;
  encounterThreat: number | null;
  encounterDifficulty: number | null;
  encounterLength: number | null;
  isPrepTurn: boolean;
  currentPrepWordIndex: number;
  vowels: string[];
  currentTurn: number;
  isActive: boolean;
  createdAt: string;
  players: PlayerData[];
  words: WordData[];
  combatLog: any[];
}

export default function Session() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const sessionId = id ? parseInt(id) : null;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sessionData, isLoading, error: sessionError } = useQuery<SessionData>({
    queryKey: ['/api/sessions', sessionId],
    enabled: !!sessionId && !isNaN(sessionId),
  });

  // Turn advancement mutation
  const advanceTurnMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/sessions/${sessionId}/turn/next`, {
        userId: user?.id,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to advance turn");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Turn Advanced",
        description: data.turnIncremented 
          ? `Turn ${data.currentTurn} has begun!` 
          : "Next player's turn",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to advance turn",
        variant: "destructive",
      });
    },
  });

  // WebSocket connection for real-time updates
  const { lastMessage } = useWebSocket(sessionId);

  // Redirect to homepage if session not found
  useEffect(() => {
    if (sessionError && !isLoading) {
      setLocation('/');
    }
  }, [sessionError, isLoading, setLocation]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'player_joined':
        case 'nerve_updated':
        case 'word_created':
        case 'combat_action':
        case 'encounter_updated':
        case 'word_approved':
        case 'turn_advanced':
        case 'word_ownership_updated':
        case 'word_defined':
        case 'potency_set':
        case 'stats_modified':
        case 'prep_turn_advanced':
          // Invalidate both session and pending words queries
          queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
          queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'pending-words'] });
          
          // Show toast for prep turn events
          if (lastMessage.type === 'prep_turn_advanced' && lastMessage.data) {
            const { isPrepTurn, currentPrepWordIndex } = lastMessage.data;
            if (isPrepTurn) {
              const wordTypes = ['noun', 'verb', 'adjective'];
              toast({
                title: "Prep Turn Advanced",
                description: `Now defining ${wordTypes[currentPrepWordIndex]}`,
              });
            } else {
              toast({
                title: "Prep Turn Complete",
                description: "All words defined! The encounter begins.",
              });
            }
          }
          break;
      }
    }
  }, [lastMessage, sessionId, queryClient, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading session...</div>
      </div>
    );
  }

  if (!sessionId || isNaN(sessionId)) {
    // Redirect to homepage for invalid session ID
    setLocation('/');
    return null;
  }

  if (!sessionData) {
    // Redirect to homepage for missing session data
    setLocation('/');
    return null;
  }

  const isGM = sessionData.gmId === user?.id;
  const currentPlayer = sessionData.players.find((p: any) => p.userId === user?.id);
  
  // Find the active player (the one with isActiveTurn = true)
  const activePlayer = sessionData.players.find(p => p.isActiveTurn);
  const isActivePlayer = activePlayer?.userId === user?.id;

  // Filter out the GM pseudo-player for player lists and turn order
  const realPlayers = sessionData.players.filter(p => p.id !== -1);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Persistent GM/Player status banner */}
      <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 1000 }}>
        <div className={isGM ? 'bg-yellow-900 text-yellow-300' : 'bg-gray-800 text-gray-300'}
          style={{ padding: '8px 16px', borderRadius: 8, fontWeight: 'bold', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
          {isGM ? 'Game Master (GM)' : 'Player'}
        </div>
      </div>
      <AppHeader session={{ id: sessionData.id, code: sessionData.code, name: sessionData.name }} />
      
      {/* Turn Counter and Controls */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 mt-12">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Card className="bg-gray-700 border-gray-600">
              <CardContent className="p-3">
                <div className="flex items-center space-x-2">
                  <Crown className="w-5 h-5 text-yellow-400" />
                  <span className="text-lg font-bold text-yellow-400">
                    Turn {sessionData.currentTurn}
                  </span>
                </div>
              </CardContent>
            </Card>
            
            <div className="flex items-center space-x-2 text-gray-300">
              <Users className="w-4 h-4" />
              <span>{sessionData.players.length} Players</span>
            </div>
          </div>
          
          {/* Next Turn Button (GM Only) */}
          {isGM && (
            <Button
              onClick={() => advanceTurnMutation.mutate()}
              disabled={advanceTurnMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              {advanceTurnMutation.isPending ? "Advancing..." : "Next Turn"}
            </Button>
          )}
        </div>
      </div>

      <EncounterHeader 
        encounterSentence={sessionData.encounterSentence}
        encounterNoun={sessionData.encounterNoun}
        encounterVerb={sessionData.encounterVerb}
        encounterAdjective={sessionData.encounterAdjective}
        encounterThreat={sessionData.encounterThreat}
        encounterDifficulty={sessionData.encounterDifficulty}
        encounterLength={sessionData.encounterLength}
        vowels={sessionData.vowels}
        isGM={isGM}
      />

      {/* Prep Turn Panel */}
      <PrepTurnPanel
        sessionId={sessionId}
        players={realPlayers}
        currentUser={user}
        isPrepTurn={sessionData.isPrepTurn}
        currentPrepWordIndex={sessionData.currentPrepWordIndex}
        encounterNoun={sessionData.encounterNoun}
        encounterVerb={sessionData.encounterVerb}
        encounterAdjective={sessionData.encounterAdjective}
        encounterThreat={sessionData.encounterThreat}
        encounterDifficulty={sessionData.encounterDifficulty}
        encounterLength={sessionData.encounterLength}
        lastMessage={lastMessage}
        isGM={isGM}
      />

      <main className="pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <PlayerPanel 
                players={realPlayers}
                words={sessionData.words}
                combatLog={sessionData.combatLog}
                currentUser={user}
                sessionId={sessionId}
                isGM={isGM}
              />
            </div>
            <div className="lg:col-span-1">
              <WordDictionary 
                words={sessionData.words}
                sessionId={sessionId}
                isGM={isGM}
                isActivePlayer={isActivePlayer}
                players={realPlayers}
                vowels={sessionData.vowels}
                gmId={sessionData.gmId}
              />
            </div>
          </div>
        </div>
      </main>

      {isGM && (
        <GameMasterPanel 
          sessionId={sessionId}
          players={realPlayers}
          currentUser={user}
          vowels={sessionData.vowels}
        />
      )}
    </div>
  );
}
