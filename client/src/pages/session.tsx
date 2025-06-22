import { useEffect } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { queryClient } from "@/lib/queryClient";
import AppHeader from "@/components/AppHeader";
import EncounterHeader from "@/components/EncounterHeader";
import PlayerPanel from "@/components/PlayerPanel";
import WordDictionary from "@/components/WordDictionary";
import GameMasterPanel from "@/components/GameMasterPanel";

export default function Session() {
  const { id } = useParams();
  const sessionId = parseInt(id!);
  const { user } = useAuth();
  const { lastMessage } = useWebSocket(sessionId);

  const { data: sessionData, isLoading } = useQuery({
    queryKey: ['/api/sessions', sessionId],
    enabled: !!sessionId,
  });

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'player_joined':
        case 'nerve_updated':
        case 'word_created':
        case 'combat_action':
        case 'encounter_updated':
          // Invalidate session data to refetch
          queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
          break;
      }
    }
  }, [lastMessage, sessionId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading session...</div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Session not found</div>
      </div>
    );
  }

  const { session, players, words, combatLog } = sessionData;
  const isGM = session.gmId === user?.id;
  const currentPlayer = players.find((p: any) => p.userId === user?.id);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <AppHeader session={session} />
      <EncounterHeader encounterSentence={session.encounterSentence} />
      
      <main className="pt-40 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <PlayerPanel 
                players={players}
                words={words}
                combatLog={combatLog}
                currentUser={user}
                sessionId={sessionId}
                isGM={isGM}
              />
            </div>
            <div className="lg:col-span-1">
              <WordDictionary 
                words={words}
                sessionId={sessionId}
                isGM={isGM}
              />
            </div>
          </div>
        </div>
      </main>

      {isGM && (
        <GameMasterPanel 
          sessionId={sessionId}
          players={players}
          session={session}
        />
      )}
    </div>
  );
}
