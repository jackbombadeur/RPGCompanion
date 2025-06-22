import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

  const playerWords = words.filter(w => w.ownerId === currentUser?.id);
  const wordCount = sentence.trim().split(/\s+/).filter(w => w.length > 0).length;
  const totalPotency = selectedWords.reduce((sum, wordId) => {
    const word = words.find(w => w.id === wordId);
    return sum + (word?.potency || 0);
  }, 0);

  const submitActionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", `/api/sessions/${sessionId}/combat`, data);
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

  const activePlayer = players.reduce((prev, current) => 
    (prev.nerve > current.nerve) ? prev : current
  );

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
          {players
            .sort((a, b) => b.nerve - a.nerve)
            .map((player, index) => {
              const isActive = player.userId === activePlayer?.userId;
              return (
                <div
                  key={player.id}
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
                        {player.user?.firstName || player.user?.email || 'Player'} 
                        {isActive && ' (Active Turn)'}
                      </span>
                      {player.userId === players.find(p => p.turnOrder === 0)?.userId && (
                        <Badge className="bg-purple-600">
                          <Crown className="w-3 h-3 mr-1" />
                          GM
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm font-medium text-white">
                      Nerve: {player.nerve}/{player.maxNerve}
                    </div>
                  </div>
                  <Progress 
                    value={(player.nerve / player.maxNerve) * 100} 
                    className="h-2"
                  />
                </div>
              );
            })}
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
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-gray-600 hover:bg-gray-500'
                  }`}
                >
                  {word.word} (Potency: {word.potency})
                </Badge>
              ))}
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Total Potency: <span className="text-yellow-400 font-semibold">+{totalPotency}</span>
            </p>
          </div>

          {/* Word Count Tracker */}
          <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
            <span className="text-sm text-gray-300">Word Count:</span>
            <span className={`text-lg font-semibold ${
              wordCount >= 2 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {wordCount}/2 minimum
            </span>
          </div>

          <Button 
            onClick={handleSubmitAction}
            disabled={!isMyTurn || wordCount < 2 || diceRoll.length === 0 || submitActionMutation.isPending}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            Submit Combat Action
          </Button>
        </CardContent>
      </Card>

      {/* Dice Rolling */}
      <DiceRoller 
        onRoll={setDiceRoll}
        potency={totalPotency}
        disabled={!isMyTurn}
      />

      {/* Combat Log */}
      <Card className="bg-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center text-white">
            <Scroll className="mr-2 text-purple-400" />
            Combat Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {combatLog.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No combat actions yet</p>
            ) : (
              combatLog.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-gray-800 rounded-lg p-3 border-l-4 border-purple-400"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-purple-400">
                      {entry.player?.firstName || entry.player?.email || 'Player'}
                    </span>
                    <span className="text-xs text-gray-400">
                      Turn {entry.turnNumber}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mb-1">"{entry.sentence}"</p>
                  <p className="text-xs text-gray-400">
                    Roll: 2d6({entry.diceRoll}) + Potency({entry.totalPotency}) = 
                    <span className="text-emerald-400 font-semibold ml-1">
                      {entry.finalResult}
                    </span>
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
