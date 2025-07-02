import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { BookOpen, Crown, ArrowRight, Plus, Minus, Shield, Target, Clock } from "lucide-react";

interface PrepTurnPanelProps {
  sessionId: number;
  players: any[];
  currentUser: any;
  isPrepTurn: boolean;
  currentPrepWordIndex: number;
  encounterNoun?: string;
  encounterVerb?: string;
  encounterAdjective?: string;
  encounterThreat?: number;
  encounterDifficulty?: number;
  encounterLength?: number;
  lastMessage?: any;
  isGM?: boolean;
}

export default function PrepTurnPanel({ 
  sessionId, 
  players, 
  currentUser, 
  isPrepTurn, 
  currentPrepWordIndex,
  encounterNoun,
  encounterVerb,
  encounterAdjective,
  encounterThreat = 1,
  encounterDifficulty = 1,
  encounterLength = 1,
  lastMessage,
  isGM = false
}: PrepTurnPanelProps) {
  const [wordMeaning, setWordMeaning] = useState("");
  const [potency, setPotency] = useState(0);
  const [currentWordPotency, setCurrentWordPotency] = useState<number | null>(null);
  const [isWordDefined, setIsWordDefined] = useState(false);
  const [hasAdjustedStat, setHasAdjustedStat] = useState(false);
  const [statToAdjust, setStatToAdjust] = useState<'threat' | 'difficulty' | 'length' | null>(null);
  const [isWordAlreadyDefined, setIsWordAlreadyDefined] = useState(false);
  const [existingWordMeaning, setExistingWordMeaning] = useState<string | null>(null);
  const [playerWordMeaning, setPlayerWordMeaning] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Find the active player (the one with isActiveTurn = true)
  const activePlayer = players.find(p => p.isActiveTurn);
  const isActivePlayer = activePlayer?.userId === user?.id;

  // Get current word based on index
  const getCurrentWord = () => {
    switch (currentPrepWordIndex) {
      case 0: return { word: encounterNoun, type: "noun", color: "bg-blue-600" };
      case 1: return { word: encounterVerb, type: "verb", color: "bg-green-600" };
      case 2: return { word: encounterAdjective, type: "adjective", color: "bg-orange-600" };
      default: return null;
    }
  };

  const currentWord = getCurrentWord();

  // Add at the top level of the component, after other useState/useRef:
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimeout = useRef<NodeJS.Timeout | null>(null);
  const [heldStat, setHeldStat] = useState<'threat' | 'difficulty' | 'length' | null>(null);
  const lastPotencyRef = useRef<number | null>(null);
  const prevWordRef = useRef<string | null>(null);

  // Fetch current word's potency when component mounts or word changes
  useEffect(() => {
    const prevWord = prevWordRef.current;
    if (currentWord?.word !== prevWord) {
      setIsWordDefined(false);
      setHasAdjustedStat(false);
      setStatToAdjust(null);
      setPlayerWordMeaning(null);
      setExistingWordMeaning(null);
      setIsWordAlreadyDefined(false);
      setWordMeaning("");
      setCurrentWordPotency(null);
      lastPotencyRef.current = null;
      fetchCurrentWordPotency();
      prevWordRef.current = currentWord?.word || null;
    }
  }, [currentWord?.word]);

  // Listen for 'word_defined' websocket event and update state immediately if the event contains the current word
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'word_defined' && lastMessage.data?.word) {
      const wsWord = lastMessage.data.word;
      if (wsWord.word === currentWord?.word) {
        setCurrentWordPotency(wsWord.potency);
        setIsWordAlreadyDefined(!!wsWord.meaning);
        setExistingWordMeaning(wsWord.meaning || null);
        setIsWordDefined(!!wsWord.meaning);
        // Debug logs
        console.log('[DEBUG][WS] word_defined event:', {
          wsWord,
          isWordDefined: !!wsWord.meaning,
          isWordAlreadyDefined: !!wsWord.meaning,
          currentWordPotency: wsWord.potency
        });
        return; // Don't refetch if we have the word object
      }
    }
    // fallback: if not the current word or no word object, use delayed refetch
    if (lastMessage && lastMessage.type === 'word_defined') {
      setTimeout(() => {
        fetchCurrentWordPotency();
      }, 300);
    }
    // eslint-disable-next-line
  }, [lastMessage]);

  // Listen for 'prep_word_meaning_defined' websocket event and update state for GM
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'prep_word_meaning_defined' && lastMessage.data?.word) {
      const wsWord = lastMessage.data.word;
      if (wsWord === currentWord?.word) {
        setPlayerWordMeaning(lastMessage.data.meaning);
        setIsWordDefined(true);
        setExistingWordMeaning(lastMessage.data.meaning || null);
        // Debug logs
        console.log('[DEBUG][WS] prep_word_meaning_defined event:', {
          wsWord,
          meaning: lastMessage.data.meaning
        });
        return;
      }
    }
    // ... existing code ...
  }, [lastMessage]);

  const fetchCurrentWordPotency = async () => {
    try {
      const response = await apiRequest("GET", `/api/sessions/${sessionId}/words`);
      if (response.ok) {
        const words = await response.json();
        const word = words.find((w: any) => w.word === currentWord?.word);
        if (word && typeof word.potency === 'number') {
          setCurrentWordPotency(word.potency);
          lastPotencyRef.current = word.potency;
          setIsWordAlreadyDefined(!!word.meaning);
          setExistingWordMeaning(word.meaning || null);
          setIsWordDefined(!!word.meaning);
          // Debug logs
          console.log("[DEBUG] fetchCurrentWordPotency:", {
            word,
            isWordDefined: !!word.meaning,
            isWordAlreadyDefined: !!word.meaning,
            currentWordPotency: word.potency
          });
        } else if (!word) {
          setCurrentWordPotency(null);
          lastPotencyRef.current = null;
          setIsWordAlreadyDefined(false);
          setExistingWordMeaning(null);
          setIsWordDefined(false);
          // Debug logs
          console.log("[DEBUG] fetchCurrentWordPotency: word not found", {
            currentWord: currentWord?.word
          });
        }
      }
    } catch (error) {
      console.error("Error fetching word potency:", error);
    }
  };

  // Define word mutation
  const defineWordMutation = useMutation({
    mutationFn: async (data: { word: string; meaning: string }) => {
      const response = await apiRequest("POST", `/api/sessions/${sessionId}/prep/define-word`, {
        word: data.word,
        meaning: data.meaning,
        userId: user?.id,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to define word");
      }
      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Word Defined",
        description: "Word meaning has been set",
      });
      setWordMeaning("");
      await fetchCurrentWordPotency();
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to define word",
        variant: "destructive",
      });
    },
  });

  // Set potency mutation
  const setPotencyMutation = useMutation({
    mutationFn: async (data: { word: string; potency: number; meaning: string }) => {
      const response = await apiRequest("POST", `/api/sessions/${sessionId}/prep/set-potency`, {
        word: data.word,
        potency: data.potency,
        meaning: data.meaning,
        userId: user?.id,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to set potency");
      }
      return response.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Potency Set",
        description: "Word potency has been set",
      });
      setPotency(0);
      setIsWordDefined(true);
      setCurrentWordPotency(data?.potency ?? 0);
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set potency",
        variant: "destructive",
      });
    },
  });

  // Modify stats mutation
  const modifyStatsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/sessions/${sessionId}/prep/modify-stats`, {
        userId: user?.id,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to modify stats");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Stats Modified",
        description: `Encounter stats updated with potency ${data.potency}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to modify stats",
        variant: "destructive",
      });
    },
  });

  // Advance prep turn mutation
  const advancePrepTurnMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/sessions/${sessionId}/prep/next-word`, {
        userId: user?.id,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to advance prep turn");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Prep Turn Advanced",
        description: "Moving to next word",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to advance prep turn",
        variant: "destructive",
      });
    },
  });

  const handleDefineWord = async () => {
    if (!currentWord?.word || !wordMeaning.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please provide a word meaning",
        variant: "destructive",
      });
      return;
    }
    setPlayerWordMeaning(wordMeaning);
    defineWordMutation.mutate({ word: currentWord.word, meaning: wordMeaning });
  };

  const handleSetPotency = () => {
    if (!currentWord?.word) {
      toast({
        title: "Invalid Input",
        description: "No word to set potency for",
        variant: "destructive",
      });
      return;
    }
    if (!playerWordMeaning) {
      toast({
        title: "Missing Meaning",
        description: "Player must define a meaning before you can set potency.",
        variant: "destructive",
      });
      return;
    }
    setPotencyMutation.mutate({ word: currentWord.word, potency, meaning: playerWordMeaning });
  };

  const handleModifyStats = () => {
    if (currentWordPotency === null) {
      toast({
        title: "Invalid Input",
        description: "GM must set potency before stats can be modified",
        variant: "destructive",
      });
      return;
    }
    modifyStatsMutation.mutate();
  };

  const handleAdvancePrepTurn = () => {
    advancePrepTurnMutation.mutate();
  };

  const statDescriptions: Record<string, string> = {
    threat: "The amount of Nerve the players will lose if they do not succeed on their turn",
    difficulty: "The number the players will need to roll to succeed in their encounter action",
    length: "The amount of successes the party will need to make to win the encounter",
  };

  if (!isPrepTurn || !currentWord?.word) {
    return null;
  }

  return (
    <Card className="bg-gray-800 border-gray-600 text-white mb-4">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <BookOpen className="mr-2 h-5 w-5 text-purple-400" />
          Prep Turn - Define Encounter Words
        </CardTitle>
        {/* Show GM status */}
        <div className="mt-2 text-sm">
          <span className={isGM ? 'text-yellow-400 font-bold' : 'text-gray-400'}>
            {isGM ? 'You are the Game Master (GM)' : 'You are a Player'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Word Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Badge className={currentWord.color}>
              {currentWord.type.toUpperCase()}
            </Badge>
            <span className="text-lg font-semibold">{currentWord.word}</span>
          </div>
          <div className="text-sm text-gray-400">
            Word {currentPrepWordIndex + 1} of 3
          </div>
        </div>

        {/* Current Player Turn Display */}
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-gray-300 text-sm">Current Turn:</span>
              <span className="font-semibold text-white">
                {activePlayer?.playerName || activePlayer?.user?.firstName || activePlayer?.user?.email || 'Unknown Player'}
              </span>
            </div>
            {isActivePlayer && (
              <Badge className="bg-green-600 text-white text-xs">Your Turn</Badge>
            )}
          </div>
        </div>

        {/* Word Definition Section */}
        {!isGM && !isWordAlreadyDefined && !isWordDefined && (
          <div className="space-y-2">
            <Label className="text-gray-300">
              Define Word Meaning
              {!isActivePlayer && (
                <span className="text-red-400 ml-2">(Not your turn)</span>
              )}
            </Label>
            <div className="flex space-x-2">
              <Input
                value={wordMeaning}
                onChange={(e) => setWordMeaning(e.target.value)}
                placeholder={isActivePlayer ? `Define what \"${currentWord.word}\" means...` : "Wait for your turn..."}
                className="bg-gray-700 border-gray-600 text-white flex-1"
                disabled={!isActivePlayer}
              />
              <Button
                onClick={handleDefineWord}
                disabled={defineWordMutation.isPending || !isActivePlayer}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {defineWordMutation.isPending ? "Defining..." : "Define"}
              </Button>
            </div>
          </div>
        )}

        {/* GM Potency Section */}
        {isGM && isWordDefined && currentWordPotency === null && playerWordMeaning && (
          <div className="space-y-2">
            <Label className="text-gray-300 flex items-center">
              <Crown className="mr-2 h-4 w-4 text-yellow-400" />
              Set Word Potency (-2 to +2)
            </Label>
            <div className="mb-2 text-gray-400 text-sm">
              <span className="font-semibold">Meaning:</span> {playerWordMeaning}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setPotency(Math.max(-2, potency - 1))}
                variant="outline"
                size="sm"
                className="border-gray-600 text-white"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-lg font-semibold min-w-[3rem] text-center">
                {potency > 0 ? `+${potency}` : potency}
              </span>
              <Button
                onClick={() => setPotency(Math.min(2, potency + 1))}
                variant="outline"
                size="sm"
                className="border-gray-600 text-white"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleSetPotency}
                disabled={setPotencyMutation.isPending || !playerWordMeaning}
                className="bg-yellow-600 hover:bg-yellow-700 ml-2"
              >
                {setPotencyMutation.isPending ? "Setting..." : "Set Potency"}
              </Button>
            </div>
            {!playerWordMeaning && (
              <div className="text-yellow-300 text-xs mt-2">Waiting for player to define a meaning...</div>
            )}
          </div>
        )}

        {/* Current Word Potency Display (removed old stat selection UI) */}
        {/* Current Stats Display (now interactive for stat selection with hold-to-confirm) */}
        <div className="bg-gray-700 rounded-lg p-3">
          <Label className="text-gray-300 text-sm mb-2 block">Current Encounter Stats</Label>
          <div className="flex w-full text-sm">
            {[
              { key: 'difficulty', label: 'Difficulty', color: 'text-yellow-400', icon: Target },
              { key: 'length', label: 'Length', color: 'text-blue-400', icon: Clock },
              { key: 'threat', label: 'Threat', color: 'text-red-400', icon: Shield },
            ].map(({ key, label, color, icon: Icon }) => {
              const value = key === 'threat' ? encounterThreat : key === 'difficulty' ? encounterDifficulty : encounterLength;
              const isSelectable = currentWordPotency !== null && isActivePlayer && !hasAdjustedStat;
              const isSelected = statToAdjust === key;
              // Hold-to-confirm handlers (now use shared state)
              const holdStart = () => {
                if (!isSelectable) return;
                setStatToAdjust(key as 'threat' | 'difficulty' | 'length');
                setHeldStat(key as 'threat' | 'difficulty' | 'length');
                let progress = 0;
                setHoldProgress(0);
                holdTimeout.current = setInterval(() => {
                  progress += 0.05;
                  setHoldProgress(progress);
                  if (progress >= 1) {
                    clearInterval(holdTimeout.current!);
                    setHoldProgress(1);
                    setHeldStat(null);
                    handleAdjustStat(key as 'threat' | 'difficulty' | 'length');
                  }
                }, 50);
              };
              const holdEnd = () => {
                if (holdTimeout.current) {
                  clearInterval(holdTimeout.current);
                  setHoldProgress(0);
                  setHeldStat(null);
                }
              };
              // Handler for stat adjustment (unchanged)
              const handleAdjustStat = async (stat: 'threat' | 'difficulty' | 'length') => {
                try {
                  const payload: any = {
                    stat,
                    userId: user?.id,
                  };
                  if (!isWordAlreadyDefined) {
                    payload.meaning = wordMeaning || existingWordMeaning;
                    payload.potency = potency;
                  }
                  const response = await apiRequest("POST", `/api/sessions/${sessionId}/prep/adjust-encounter-stat`, payload);
                  if (!response.ok) throw new Error("Failed to adjust stat");
                  setHasAdjustedStat(true);
                  toast({ title: "Stat Adjusted", description: `Adjusted ${stat} by ${currentWordPotency}` });
                  queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
                } catch (e) {
                  toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
                }
              };
              return (
                <div
                  key={key}
                  className={`relative flex flex-col items-center justify-center transition cursor-${isSelectable ? 'pointer' : 'default'} rounded-lg flex-1 bg-gray-800 border-2 ${isSelected ? 'border-purple-400' : 'border-gray-600'} shadow-sm h-40 min-h-[8rem]`}
                  tabIndex={isSelectable ? 0 : -1}
                  role={isSelectable ? 'button' : undefined}
                  aria-pressed={isSelected}
                  onMouseDown={holdStart}
                  onTouchStart={holdStart}
                  onMouseUp={holdEnd}
                  onMouseLeave={holdEnd}
                  onTouchEnd={holdEnd}
                  onTouchCancel={holdEnd}
                  style={{ minWidth: 0 }}
                >
                  <Icon className={`${color} w-6 h-6 mb-1 z-10`} />
                  <div className={`${color} font-semibold text-lg z-10`}>{value}</div>
                  <div className="text-gray-400 z-10">{label}</div>
                  <div className="text-xs text-gray-300 text-center mt-1 z-10 min-h-[2.5rem]">{statDescriptions[key]}</div>
                  {/* Circular loading bar for hold-to-confirm (only for the held stat) */}
                  {isSelectable && heldStat === key && holdProgress > 0 && !hasAdjustedStat && (
                    <svg className="absolute top-2 left-2 w-6 h-6 z-20 pointer-events-none" style={{right: 'unset', bottom: 'unset'}} viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="#a78bfa" strokeWidth="3" fill="none" opacity="0.2" />
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="#a78bfa"
                        strokeWidth="3"
                        fill="none"
                        strokeDasharray={2 * Math.PI * 10}
                        strokeDashoffset={(1 - holdProgress) * 2 * Math.PI * 10}
                        strokeLinecap="round"
                        className="transition-all duration-50"
                      />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Advance Button */}
        <div className="space-y-2">
          {!isActivePlayer ? (
            !isWordDefined ? (
              <div className="text-center text-gray-400 text-sm">
                Waiting for {activePlayer?.playerName || activePlayer?.user?.firstName || 'current player'} to define the word...
              </div>
            ) : null
          ) : (
            currentWordPotency !== null && hasAdjustedStat && (
              <Button
                onClick={handleAdvancePrepTurn}
                disabled={advancePrepTurnMutation.isPending}
                className="w-full bg-green-600 hover:bg-green-700 mt-4"
              >
                {advancePrepTurnMutation.isPending ? "Advancing..." : (
                  <>
                    {currentPrepWordIndex < 2 ? "Next Word" : "End Prep Turn"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
} 