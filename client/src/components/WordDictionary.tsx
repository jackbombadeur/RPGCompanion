import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { BookOpen, Plus, Clock, CheckCircle, Dice1, Users } from "lucide-react";

interface WordDictionaryProps {
  words: any[];
  sessionId: number;
  isGM: boolean;
  isActivePlayer: boolean;
  players: any[];
  vowels: string[];
  gmId: string;
}

// Utility function to generate a word based on dice rolls and vowels
function generateWordFromVowels(vowels: string[]): { word: string; rolls: number[] } {
  // Roll 1d6, divide by 2, round up
  const initialRoll = Math.floor(Math.random() * 6) + 1;
  const numDice = Math.ceil(initialRoll / 2);
  
  // Roll that many d6
  const rolls: number[] = [];
  for (let i = 0; i < numDice; i++) {
    rolls.push(Math.floor(Math.random() * 6) + 1);
  }
  
  // Create word from vowels at the rolled positions (1-indexed, so subtract 1)
  const word = rolls.map(roll => vowels[roll - 1]).join('');
  
  return { word, rolls };
}

export default function WordDictionary({ words, sessionId, isGM, isActivePlayer, players, vowels, gmId }: WordDictionaryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [newWord, setNewWord] = useState({
    word: "",
    meaning: "",
    category: "noun" as "noun" | "verb" | "adjective",
  });
  const [generatedWord, setGeneratedWord] = useState<{ word: string; rolls: number[] } | null>(null);
  const [selectedWord, setSelectedWord] = useState<any>(null);
  const [potency, setPotency] = useState(0);
  const [scrollState, setScrollState] = useState<'top' | 'middle' | 'bottom'>('top');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch pending words for GM
  const { data: pendingWords = [] } = useQuery({
    queryKey: ['/api/sessions', sessionId, 'pending-words'],
    queryFn: async () => {
      if (!isGM) return [];
      const response = await apiRequest("GET", `/api/sessions/${sessionId}/words/pending`);
      return response.json();
    },
    enabled: isGM && !!user?.id,
  });

  const createWordMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", `/api/sessions/${sessionId}/words`, {
        ...data,
        userId: user?.id,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create word");
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.isExisting) {
        toast({
          title: "Word Already Exists",
          description: data.message,
        });
      } else {
        toast({
          title: "Word Created",
          description: "Word submitted for GM approval",
        });
      }
      setNewWord({ word: "", meaning: "", category: "noun" });
      setGeneratedWord(null);
      setIsAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create word",
        variant: "destructive",
      });
    },
  });

  const approveWordMutation = useMutation({
    mutationFn: async (data: { wordId: number; potency: number }) => {
      const response = await apiRequest("POST", `/api/sessions/${sessionId}/words/${data.wordId}/approve`, {
        userId: user?.id,
        potency: data.potency,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to approve word");
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      const potency = variables.potency;
      let description = "Word has been approved and added to dictionary";
      
      if (potency > 0) {
        description += `. Word owners' nerve reduced by ${potency} (positive potency = negative effect)`;
      } else if (potency < 0) {
        description += `. Word owners' nerve increased by ${Math.abs(potency)} (negative potency = positive effect)`;
      }
      
      toast({
        title: "Word Approved",
        description: description,
      });
      setSelectedWord(null);
      setPotency(0);
      setIsApproveDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'pending-words'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve word",
        variant: "destructive",
      });
    },
  });

  const filteredWords = words.filter(word =>
    String(word.word).toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(word.meaning).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleGenerateWord = () => {
    const result = generateWordFromVowels(vowels);
    setGeneratedWord(result);
    setNewWord({ ...newWord, word: result.word });
  };

  const handleCreateWord = () => {
    if (!newWord.word.trim()) {
      toast({
        title: "Invalid Word",
        description: "Word is required",
        variant: "destructive",
      });
      return;
    }

    // Check if this is an existing word
    const isExistingWord = words.some(w => w.word === newWord.word);
    
    // Only require meaning for new words
    if (!isExistingWord && !newWord.meaning.trim()) {
      toast({
        title: "Invalid Word",
        description: "Meaning is required for new words",
        variant: "destructive",
      });
      return;
    }

    // Prepare data to send - only include meaning and category for new words
    const dataToSend: {
      word: string;
      userId: any;
      meaning?: string;
      category?: string;
    } = {
      word: newWord.word,
      userId: user?.id,
    };

    // Only add meaning and category for new words
    if (!isExistingWord) {
      dataToSend.meaning = newWord.meaning;
      dataToSend.category = newWord.category;
    }

    createWordMutation.mutate(dataToSend);
  };

  const handleApproveWord = (wordToApprove?: any, potencyValue?: number) => {
    const targetWord = wordToApprove || selectedWord;
    const targetPotency = potencyValue !== undefined ? potencyValue : potency;
    
    if (!targetWord || targetPotency < -2 || targetPotency > 2 || !Number.isInteger(targetPotency)) {
      toast({
        title: "Invalid Potency",
        description: "Potency must be between -2 and 2 (whole numbers only)",
        variant: "destructive",
      });
      return;
    }

    approveWordMutation.mutate({ wordId: targetWord.id, potency: targetPotency });
  };

  const getPlayerName = (ownerId: string) => {
    const player = players.find(p => p.userId === ownerId);
    if (player) {
      const playerName = player?.playerName || player?.user?.firstName || player?.user?.email || 'Unknown';
      // Add "(You)" indicator if this is the current user's word
      const isCurrentUser = player?.userId === user?.id;
      return isCurrentUser ? `${playerName} (You)` : playerName;
    }
    if (ownerId === gmId) {
      return 'Game Master';
    }
    return 'Unknown';
  };

  const getWordOwners = (word: any) => {
    // For now, we'll use the ownerId if it exists (backward compatibility)
    // In the future, this should be replaced with a proper owners array
    if (word.ownerId) {
      return [word.ownerId];
    }
    // If we have an owners array, use that
    if (word.owners && Array.isArray(word.owners)) {
      return word.owners;
    }
    return [];
  };

  // Handle scroll events to update gradient indicators
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrollPercentage = scrollTop / (scrollHeight - clientHeight);

    if (scrollTop === 0) {
      setScrollState('top');
    } else if (scrollTop + clientHeight >= scrollHeight - 1) {
      setScrollState('bottom');
    } else {
      setScrollState('middle');
    }
  };

  // Add scroll event listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [filteredWords.length]); // Re-add listener when word list changes

  return (
    <Card className="bg-gray-700 sticky top-52 min-w-[400px]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-white">
          <div className="flex items-center">
            <BookOpen className="mr-2 text-purple-400" />
            Word Dictionary
          </div>
          <Badge variant="secondary" className="text-xs bg-gray-600 text-gray-300">
            {filteredWords.length} {filteredWords.length === 1 ? 'word' : 'words'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <Input
          placeholder="Search words..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-gray-800 border-gray-600 text-white"
        />

        {/* Word List */}
        <div className="relative">
          <div 
            ref={scrollContainerRef}
            className="space-y-3 max-h-96 overflow-y-auto scrollbar-hide"
          >
            {filteredWords.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No words found</p>
            ) : (
              filteredWords.map((word) => {
                // TEMP DEBUG LOG
                console.log('[WordDictionary DEBUG]', {
                  word: word.word,
                  owners: word.owners,
                  gmId: gmId
                });
                return (
                  <div key={word.id} className="bg-gray-800 rounded-lg p-4">
                    {/* Word header with badges */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-purple-400 text-lg break-words">
                          {word.word}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge className={`text-xs whitespace-nowrap ${
                          word.category === 'noun' ? 'bg-blue-600 text-white' :
                          word.category === 'verb' ? 'bg-green-600 text-white' :
                          'bg-orange-600 text-white'
                        }`}>
                          {word.category || 'noun'}
                        </Badge>
                        {word.potency === null ? (
                          <Badge className="bg-yellow-600 text-white whitespace-nowrap">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        ) : (
                          <Badge className={`text-xs whitespace-nowrap ${
                            word.potency < 0 ? 'bg-red-600 text-white' :
                            word.potency === 0 ? 'bg-gray-600 text-white' :
                            'bg-yellow-500 text-black'
                          }`}>
                            {word.potency > 0 ? `+${word.potency}` : word.potency}
                          </Badge>
                        )}
                        {word.isApproved && (
                          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                    
                    {/* Word meaning */}
                    {word.meaning && (
                      <p className="text-sm text-gray-300 mb-3 leading-relaxed">{word.meaning}</p>
                    )}
                    
                    {/* Word owners */}
                    <div className="text-xs text-gray-400">
                      {(() => {
                        const owners = getWordOwners(word);
                        if (owners.length === 0) {
                          return <span>Owner: Game Master</span>;
                        } else if (owners.length === 1) {
                          return <span>Owner: {getPlayerName(owners[0])}</span>;
                        } else {
                          return (
                            <div>
                              <span className="font-medium text-purple-400">Owners ({owners.length}):</span>
                              <div className="mt-1 space-y-1">
                                {owners.map((ownerId: string) => (
                                  <div key={ownerId} className="ml-2 text-gray-300">
                                    • {getPlayerName(ownerId)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {/* Dynamic gradient fade indicators based on scroll position */}
          {filteredWords.length > 3 && (
            <>
              {/* Top gradient - shows when scrolled down (middle or bottom) */}
              {(scrollState === 'middle' || scrollState === 'bottom') && (
                <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-gray-700 to-transparent pointer-events-none transition-opacity duration-200" />
              )}
              {/* Bottom gradient - shows when not at bottom (top or middle) */}
              {(scrollState === 'top' || scrollState === 'middle') && (
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-700 to-transparent pointer-events-none transition-opacity duration-200" />
              )}
            </>
          )}
        </div>

        {/* Add New Word (Active Player Only) */}
        {isActivePlayer && (
          <div className="pt-4 border-t border-gray-600">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full bg-purple-600 hover:bg-purple-700" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Define New Word (Your Turn)
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-800 border-gray-600 max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-white">Define New Word</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Vowels Display */}
                  <div className="bg-gray-700 rounded-lg p-3">
                    <Label className="text-gray-300 text-sm mb-2 block">Available Vowels</Label>
                    <div className="flex flex-wrap gap-2">
                      {vowels.map((vowel, index) => (
                        <Badge key={index} className="bg-purple-600 text-white">
                          {index + 1}: {vowel}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Word Generation */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-gray-300 text-sm">Generate Word</Label>
                      <Button
                        onClick={handleGenerateWord}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        disabled={generatedWord !== null}
                      >
                        <Dice1 className="w-4 h-4 mr-1" />
                        {generatedWord ? "Word Locked" : "Roll Dice"}
                      </Button>
                    </div>
                    {generatedWord && (
                      <div className="bg-green-600 bg-opacity-20 border border-green-400 rounded-lg p-3">
                        <p className="text-sm text-green-400 mb-2">
                          Generated: <span className="font-bold text-lg">{generatedWord.word}</span>
                        </p>
                        <div className="space-y-2">
                          <p className="text-xs text-gray-300 font-semibold">Dice Results:</p>
                          <div className="flex flex-wrap gap-2">
                            {generatedWord.rolls.map((roll, index) => (
                              <div key={index} className="bg-gray-600 rounded px-2 py-1 text-xs">
                                <span className="text-yellow-400 font-bold">D{index + 1}: {roll}</span>
                                <span className="text-gray-300 ml-1">→ {vowels[roll - 1]}</span>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-gray-400 mt-2">
                            Word formed from vowels: {generatedWord.rolls.map(roll => `${roll}(${vowels[roll - 1]})`).join(' + ')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="word" className="text-gray-300">Word</Label>
                    <Input
                      id="word"
                      value={newWord.word}
                      onChange={(e) => setNewWord({ ...newWord, word: e.target.value })}
                      className="bg-gray-700 border-gray-600 text-white"
                      placeholder="Word will be generated by dice roll"
                      disabled={true}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Word is automatically generated from dice roll
                    </p>
                  </div>
                  
                  {/* Only show meaning field if this is a new word (not an existing one) */}
                  {generatedWord && !words.some(w => w.word === generatedWord.word) && (
                    <>
                      <div>
                        <Label htmlFor="meaning" className="text-gray-300">Meaning</Label>
                        <Textarea
                          id="meaning"
                          value={newWord.meaning}
                          onChange={(e) => setNewWord({ ...newWord, meaning: e.target.value })}
                          className="bg-gray-700 border-gray-600 text-white"
                          placeholder="A noun, verb, or adjective"
                        />
                      </div>
                      <div>
                        <Label htmlFor="category" className="text-gray-300">Category</Label>
                        <Select
                          value={newWord.category}
                          onValueChange={(value: "noun" | "verb" | "adjective") => 
                            setNewWord({ ...newWord, category: value })
                          }
                        >
                          <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-700 border-gray-600">
                            <SelectItem value="noun">Noun</SelectItem>
                            <SelectItem value="verb">Verb</SelectItem>
                            <SelectItem value="adjective">Adjective</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  
                  {/* Show different message based on whether it's a new or existing word */}
                  {generatedWord && words.some(w => w.word === generatedWord.word) ? (
                    <div className="bg-blue-600 bg-opacity-20 border border-blue-400 rounded-lg p-3">
                      <p className="text-sm text-blue-400">
                        This word already exists! You will become an owner of "{generatedWord.word}" when you submit.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">
                      GM will set the potency value (-2 to 2) after reviewing your word.
                    </p>
                  )}
                  <Button
                    onClick={handleCreateWord}
                    disabled={createWordMutation.isPending || !generatedWord}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {createWordMutation.isPending ? "Submitting..." : 
                     generatedWord && words.some(w => w.word === generatedWord.word) 
                       ? "Become Owner" 
                       : "Submit Word"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* GM Word Approval */}
        {isGM && pendingWords.length > 0 && (
          <div className="pt-4 border-t border-gray-600">
            <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full bg-yellow-600 hover:bg-yellow-700" size="sm">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Review Pending Words ({pendingWords.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-800 border-gray-600 max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-white">Review Pending Words</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Nerve mechanics info */}
                  <div className="bg-blue-600 bg-opacity-20 border border-blue-400 rounded-lg p-3">
                    <h4 className="font-medium text-blue-400 mb-2">Potency Effects on Player Nerve:</h4>
                    <div className="text-sm text-blue-300 space-y-1">
                      <p>• <strong>Positive potency (+1, +2):</strong> Reduces word owners' nerve (negative effect)</p>
                      <p>• <strong>Negative potency (-1, -2):</strong> Increases word owners' nerve (positive effect)</p>
                      <p>• <strong>Zero potency (0):</strong> No nerve change</p>
                      <p>• <strong>Word approval protection:</strong> Nerve cannot go below 1 from word approval</p>
                      <p>• <strong>Manual adjustment:</strong> GM can manually set nerve to 0-8</p>
                    </div>
                  </div>
                  
                  {pendingWords.map((word: any) => (
                    <div key={word.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-gray-500 transition-colors">
                      {/* Word header */}
                      <div className="mb-3">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-lg text-purple-400 mb-1 break-words">{word.word}</h4>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Badge className={`text-xs whitespace-nowrap ${
                                word.category === 'noun' ? 'bg-blue-600 text-white' :
                                word.category === 'verb' ? 'bg-green-600 text-white' :
                                'bg-orange-600 text-white'
                              }`}>
                                {word.category || 'noun'}
                              </Badge>
                              {word.meaning && (
                                <span className="text-sm text-gray-300 break-words">{word.meaning}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Owner information */}
                        <div className="flex items-center space-x-2 text-xs text-gray-400">
                          <span>by {(() => {
                            const owners = getWordOwners(word);
                            if (owners.length === 1) {
                              return getPlayerName(owners[0]);
                            } else {
                              return (
                                <HoverCard>
                                  <HoverCardTrigger asChild>
                                    <span className="flex items-center cursor-pointer text-purple-400 hover:text-purple-300">
                                      <Users className="w-3 h-3 mr-1" />
                                      {owners.length} players
                                    </span>
                                  </HoverCardTrigger>
                                  <HoverCardContent className="w-64 bg-gray-800 border-gray-600">
                                    <div className="space-y-2">
                                      <h4 className="font-medium text-white">Word Owners:</h4>
                                      <div className="space-y-1">
                                        {owners.map((ownerId: string) => (
                                          <div key={ownerId} className="text-sm text-gray-300">
                                            • {getPlayerName(ownerId)}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </HoverCardContent>
                                </HoverCard>
                              );
                            }
                          })()}</span>
                          <span>•</span>
                          <span>Pending approval</span>
                        </div>
                      </div>
                      
                      {/* Approval controls */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-gray-600">
                        <div className="flex items-center space-x-3">
                          <Label className="text-gray-300 text-sm font-medium whitespace-nowrap">
                            Potency:
                          </Label>
                          <Select
                            value={selectedWord?.id === word.id ? potency.toString() : "0"}
                            onValueChange={(value) => {
                              setSelectedWord(word);
                              setPotency(Number(value));
                            }}
                          >
                            <SelectTrigger className="w-20 bg-gray-600 border-gray-500 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-700 border-gray-600">
                              <SelectItem value="-2">-2</SelectItem>
                              <SelectItem value="-1">-1</SelectItem>
                              <SelectItem value="0">0</SelectItem>
                              <SelectItem value="1">1</SelectItem>
                              <SelectItem value="2">2</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <Button
                          onClick={() => {
                            const currentPotency = selectedWord?.id === word.id ? potency : 0;
                            handleApproveWord(word, currentPotency);
                          }}
                          disabled={approveWordMutation.isPending}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {approveWordMutation.isPending ? "Approving..." : "Approve"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
