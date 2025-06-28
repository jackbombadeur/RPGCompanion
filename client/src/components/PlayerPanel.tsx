import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import DiceRoller from "./DiceRoller";
import { Users, Edit, Scroll, Crown } from "lucide-react";

interface PlayerPanelProps {
  players: any[];
  words: any[];
  combatLog: any[];
  currentUser: any;
  sessionId: number;
  isGM: boolean;
}

export default function PlayerPanel({ 
  players, 
  words, 
  combatLog, 
  currentUser, 
  sessionId, 
  isGM 
}: PlayerPanelProps) {
  const [sentence, setSentence] = useState("");
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  const [diceRoll, setDiceRoll] = useState<number[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  const playerWords = words.filter(w => w.ownerId === currentUser?.id && w.potency !== null && w.isApproved);
  const wordCount = sentence.trim().split(/\s+/).filter(w => w.length > 0).length;
  const totalPotency = selectedWords.reduce((sum, wordId) => {
    const word = words.find(w => w.id === wordId);
    return sum + (word?.potency || 0);
  }, 0);

  const submitActionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", `/api/sessions/${sessionId}/combat`, {
        ...data,
        userId: user?.id,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Combat Action Submitted",
        description: "Your action has been recorded",
      });
      setSentence("");
      setSelectedWords([]);
      setDiceRoll([]);
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit combat action",
        variant: "destructive",
      });
    },
  });

  const handleSubmitAction = () => {
    if (wordCount < 2 || diceRoll.length === 0) {
      toast({
        title: "Invalid Action",
        description: "Need at least 2 words and dice roll",
        variant: "destructive",
      });
      return;
    }

    const usedWords = selectedWords.map(wordId => {
      const word = words.find(w => w.id === wordId);
      return { id: wordId, potency: word?.potency || 0 };
    });

    submitActionMutation.mutate({
      sentence,
      usedWords,
      diceRoll: diceRoll.reduce((a, b) => a + b, 0),
      totalPotency,
      finalResult: diceRoll.reduce((a, b) => a + b, 0) + totalPotency,
      turnNumber: combatLog.length + 1,
    });
  };

  const toggleWordSelection = (wordId: number) => {
    setSelectedWords(prev => 
      prev.includes(wordId) 
        ? prev.filter(id => id !== wordId)
        : [...prev, wordId]
    );
  };

  // Find the active player (the one with isActiveTurn = true)
  const activePlayer = players.find(p => p.isActiveTurn);
  const isMyTurn = activePlayer?.userId === currentUser?.id;

  return (
    <div className="space-y-6">
      {/* Turn Order & Player Status */}
      <Card className="bg-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center text-white">
            <Users className="mr-2 text-purple-400" />
            Turn Order & Player Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {players && players.length > 0 ? (
            players
              .filter(player => player && typeof player === 'object')
              .map((player, index) => {
                const isActive = player?.isActiveTurn;
                return (
                  <div
                    key={player?.id || index}
                    className={`rounded-lg p-4 ${
                      isActive 
                        ? 'bg-yellow-500 bg-opacity-20 border-2 border-yellow-400' 
                        : 'bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          isActive ? 'bg-yellow-400 animate-pulse' : 'bg-gray-500'
                        }`} />
                        <span className={`font-semibold ${
                          isActive ? 'text-yellow-400' : 'text-white'
                        }`}>
                          {player?.playerName || player?.user?.firstName || player?.user?.email || 'Player'} 
                          {player?.userId === currentUser?.id && ' (You)'}
                          {isActive && ' (Active Turn)'}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-white">
                        Nerve: {player?.nerve || 0}/{player?.maxNerve || 8}
                      </div>
                    </div>
                    <Progress 
                      value={((player?.nerve || 0) / (player?.maxNerve || 8)) * 100} 
                      className="h-2"
                    />
                  </div>
                );
              })
          ) : (
            <p className="text-gray-400 text-center py-4">No players in session</p>
          )}
        </CardContent>
      </Card>

      {/* Sentence Construction */}
      <Card className="bg-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center text-white">
            <Edit className="mr-2 text-purple-400" />
            Combat Action {isMyTurn ? "(Your Turn)" : "(Not Your Turn)"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Construct Your Sentence (2+ words minimum)
            </label>
            <Textarea
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              className="bg-gray-800 border-gray-600 text-white"
              rows={3}
              placeholder="Create your combat sentence using your owned words..."
              disabled={!isMyTurn}
            />
          </div>

          {/* Word Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Your Words (Click to add potency)
            </label>
            <div className="flex flex-wrap gap-2">
              {playerWords.map((word) => (
                <Badge
                  key={word.id}
                  onClick={() => toggleWordSelection(word.id)}
                  className={`cursor-pointer ${
                    selectedWords.includes(word.id)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  {word.word} ({word.potency})
                </Badge>
              ))}
            </div>
          </div>

          {/* Dice Roller */}
          <DiceRoller
            onRoll={setDiceRoll}
            potency={totalPotency}
            disabled={!isMyTurn}
          />

          {/* Action Summary */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Action Summary</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Words Used:</span>
                <span className="text-white">{wordCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Potency:</span>
                <span className="text-purple-400">{totalPotency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Dice Roll:</span>
                <span className="text-yellow-400">
                  {diceRoll.length > 0 ? diceRoll.join(' + ') + ' = ' + diceRoll.reduce((a, b) => a + b, 0) : 'Not rolled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Final Result:</span>
                <span className="text-green-400">
                  {diceRoll.length > 0 ? diceRoll.reduce((a, b) => a + b, 0) + totalPotency : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmitAction}
            disabled={!isMyTurn || submitActionMutation.isPending || wordCount < 2 || diceRoll.length === 0}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {submitActionMutation.isPending ? "Submitting..." : "Submit Combat Action"}
          </Button>
        </CardContent>
      </Card>

      {/* Combat Log */}
      <Card className="bg-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center text-white">
            <Scroll className="mr-2 text-purple-400" />
            Combat Log
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-96 overflow-y-auto">
          {combatLog && combatLog.length > 0 ? (
            combatLog.map((entry, index) => (
              <div key={entry.id || index} className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-purple-400 text-sm">
                    Turn {entry.turnNumber || index + 1}
                  </span>
                  <span className="text-sm text-gray-400">
                    {entry.player?.playerName || entry.player?.user?.firstName || entry.player?.user?.email || 'Player'}
                  </span>
                </div>
                <p className="text-sm text-white mb-2">{entry.sentence}</p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Dice: {entry.diceRoll}</span>
                  <span>Potency: {entry.totalPotency}</span>
                  <span>Result: {entry.finalResult}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-center py-4">No combat actions yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
