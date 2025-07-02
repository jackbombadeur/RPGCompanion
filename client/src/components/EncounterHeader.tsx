import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Edit, RefreshCw, Shield, Target, Clock, Dice1 } from "lucide-react";

interface EncounterHeaderProps {
  encounterSentence?: string | null;
  encounterNoun?: string | null;
  encounterVerb?: string | null;
  encounterAdjective?: string | null;
  encounterThreat?: number | null;
  encounterDifficulty?: number | null;
  encounterLength?: number | null;
  vowels?: string[];
  isGM?: boolean;
  onUpdateEncounter?: (sentence: string) => void;
}

// Word generation function (same as in WordDictionary)
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

// Add sentence templates
const sentenceTemplates = [
  (noun: string, verb: string, adjective: string) => `The ${adjective} ${noun} will ${verb}.`,
  (noun: string, verb: string, adjective: string) => `Beware the ${adjective} ${noun} that will ${verb}.`,
  (noun: string, verb: string, adjective: string) => `A ${adjective} ${noun} is about to ${verb}.`,
  (noun: string, verb: string, adjective: string) => `Prepare for the ${adjective} ${noun} who plans to ${verb}.`,
];

// Utility to normalize words (lowercase, strip punctuation)
function normalizeWord(word: string) {
  return word.toLowerCase().replace(/[^a-z0-9]/gi, '');
}

export default function EncounterHeader({ 
  encounterSentence, 
  encounterNoun, 
  encounterVerb, 
  encounterAdjective, 
  encounterThreat, 
  encounterDifficulty, 
  encounterLength, 
  vowels, 
  isGM, 
  onUpdateEncounter 
}: EncounterHeaderProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEncounter, setNewEncounter] = useState({
    sentence: encounterSentence || "",
    threat: encounterThreat || 1,
    difficulty: encounterDifficulty || 1,
    length: encounterLength || 1,
  });
  
  // State for generated encounter words
  const [generatedWords, setGeneratedWords] = useState({
    noun: encounterNoun || "",
    verb: encounterVerb || "",
    adjective: encounterAdjective || "",
  });
  
  const { toast } = useToast();
  const { user } = useAuth();

  // Word generation functions
  const generateNoun = () => {
    const result = generateWordFromVowels(vowels || []);
    setGeneratedWords(prev => ({ ...prev, noun: result.word }));
  };

  const generateVerb = () => {
    const result = generateWordFromVowels(vowels || []);
    setGeneratedWords(prev => ({ ...prev, verb: result.word }));
  };

  const generateAdjective = () => {
    const result = generateWordFromVowels(vowels || []);
    setGeneratedWords(prev => ({ ...prev, adjective: result.word }));
  };

  const generateAllWords = () => {
    // Generate all three words at once
    const nounResult = generateWordFromVowels(vowels || []);
    const verbResult = generateWordFromVowels(vowels || []);
    const adjectiveResult = generateWordFromVowels(vowels || []);
    const noun = nounResult.word;
    const verb = verbResult.word;
    const adjective = adjectiveResult.word;
    setGeneratedWords({ noun, verb, adjective });

    // Only set the sentence if appropriate
    const prevSentence = newEncounter.sentence;
    const isPrevTemplate = sentenceTemplates.some(fn => prevSentence === fn(noun, verb, adjective));
    if (!prevSentence || isPrevTemplate) {
      const template = sentenceTemplates[Math.floor(Math.random() * sentenceTemplates.length)];
      setNewEncounter(enc => ({ ...enc, sentence: template(noun, verb, adjective) }));
    }
  };

  const updateEncounterMutation = useMutation({
    mutationFn: async (data: { 
      sentence: string; 
      threat: string; 
      difficulty: string; 
      length: string;
      noun: string;
      verb: string;
      adjective: string;
    }) => {
      const response = await apiRequest("PATCH", `/api/sessions/${window.location.pathname.split('/').pop()}/encounter`, {
        userId: user?.id,
        sentence: data.sentence,
        threat: data.threat,
        difficulty: data.difficulty,
        length: data.length,
        noun: data.noun,
        verb: data.verb,
        adjective: data.adjective,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update encounter");
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.isNewEncounter) {
        toast({
          title: "New Encounter Started!",
          description: "Turn counter has been reset to 1. All pending words have been cleared.",
        });
      } else {
        toast({
          title: "Encounter Updated",
          description: "Encounter details have been updated",
        });
      }
      setIsDialogOpen(false);
      // Reset generated words to current encounter words
      setGeneratedWords({
        noun: encounterNoun || "",
        verb: encounterVerb || "",
        adjective: encounterAdjective || "",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update encounter",
        variant: "destructive",
      });
    },
  });

  const handleUpdateEncounter = () => {
    if (!newEncounter.sentence.trim()) {
      toast({
        title: "Invalid Encounter",
        description: "Encounter sentence cannot be empty",
        variant: "destructive",
      });
      return;
    }
    
    if (!generatedWords.noun || !generatedWords.verb || !generatedWords.adjective) {
      toast({
        title: "Missing Encounter Words",
        description: "Please generate all three encounter words (noun, verb, adjective)",
        variant: "destructive",
      });
      return;
    }
    
    updateEncounterMutation.mutate({
      sentence: newEncounter.sentence,
      threat: newEncounter.threat.toString(),
      difficulty: newEncounter.difficulty.toString(),
      length: newEncounter.length.toString(),
      noun: generatedWords.noun,
      verb: generatedWords.verb,
      adjective: generatedWords.adjective,
    });
  };

  // Function to identify encounter words in the sentence and create hoverable elements
  const renderEncounterSentence = (sentence: string) => {
    if (!sentence || (!encounterNoun && !encounterVerb && !encounterAdjective)) {
      return sentence;
    }

    const words = sentence.split(/(\s+)/); // keep spaces as tokens
    const encounterWordMap: Record<string, string> = {};
    if (encounterNoun) encounterWordMap[normalizeWord(encounterNoun)] = 'Noun';
    if (encounterVerb) encounterWordMap[normalizeWord(encounterVerb)] = 'Verb';
    if (encounterAdjective) encounterWordMap[normalizeWord(encounterAdjective)] = 'Adjective';

    return words.map((word, index) => {
      // Only check non-space tokens
      if (!/\s+/.test(word)) {
        const normalized = normalizeWord(word);
        const wordType = encounterWordMap[normalized];
        if (wordType) {
          return (
            <HoverCard key={index}>
              <HoverCardTrigger asChild>
                <span className="cursor-help border-b border-dashed border-purple-300 text-purple-200 hover:text-purple-100 transition-colors">
                  {word}
                </span>
              </HoverCardTrigger>
              <HoverCardContent className="w-auto bg-gray-800 border-gray-600 p-2">
                <div className="text-sm">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                    wordType === 'Noun' ? 'bg-blue-600 text-white' :
                    wordType === 'Verb' ? 'bg-green-600 text-white' :
                    'bg-orange-600 text-white'
                  }`}>
                    {wordType}
                  </span>
                  <span className="ml-2 text-gray-300">{word}</span>
                </div>
              </HoverCardContent>
            </HoverCard>
          );
        }
      }
      return <span key={index}>{word}</span>;
    });
  };

  return (
    <div className="w-full bg-purple-600 border-b border-purple-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-between">
          <div className="flex-1 text-center">
            <h2 className="text-base font-semibold text-white mb-1">Current Encounter</h2>
            <div className="bg-purple-700 rounded-lg p-2">
              <p className="text-lg font-bold text-white">
                {encounterSentence ? renderEncounterSentence(encounterSentence) : "No encounter set"}
              </p>
              <p className="text-purple-200 text-xs mt-1">GM's Encounter Words (hover over underlined words)</p>
              
              {/* Encounter Stats */}
              {(encounterThreat || encounterDifficulty || encounterLength) && (
                <div className="flex justify-center space-x-4 mt-2 text-xs">
                  {encounterThreat && (
                    <div className="flex items-center space-x-1 text-red-200">
                      <Shield className="w-3 h-3" />
                      <span>Threat: {encounterThreat}</span>
                    </div>
                  )}
                  {encounterDifficulty && (
                    <div className="flex items-center space-x-1 text-yellow-200">
                      <Target className="w-3 h-3" />
                      <span>Difficulty: {encounterDifficulty}</span>
                    </div>
                  )}
                  {encounterLength && (
                    <div className="flex items-center space-x-1 text-blue-200">
                      <Clock className="w-3 h-3" />
                      <span>Length: {encounterLength}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Edit Encounter Button (GM Only) */}
          {isGM && (
            <div className="ml-4">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-purple-800 hover:bg-purple-900" size="sm">
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Encounter
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-gray-800 border-gray-600">
                  <DialogHeader>
                    <DialogTitle className="text-white">Edit Encounter</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* Word Generation Section */}
                    <div className="bg-purple-600 bg-opacity-20 border border-purple-400 rounded-lg p-4">
                      <h4 className="font-medium text-purple-400 mb-3">Generate Encounter Words</h4>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Button
                            type="button"
                            onClick={generateAllWords}
                            size="sm"
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            <Dice1 className="mr-2 h-4 w-4" />
                            Generate All Words
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-gray-300 text-sm">Noun</Label>
                            <div className="flex space-x-2">
                              <Input
                                value={generatedWords.noun}
                                onChange={(e) => setGeneratedWords(prev => ({ ...prev, noun: e.target.value }))}
                                className="bg-gray-700 border-gray-600 text-white"
                                placeholder="Generate noun..."
                              />
                              <Button
                                type="button"
                                onClick={generateNoun}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                <Dice1 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <div>
                            <Label className="text-gray-300 text-sm">Verb</Label>
                            <div className="flex space-x-2">
                              <Input
                                value={generatedWords.verb}
                                onChange={(e) => setGeneratedWords(prev => ({ ...prev, verb: e.target.value }))}
                                className="bg-gray-700 border-gray-600 text-white"
                                placeholder="Generate verb..."
                              />
                              <Button
                                type="button"
                                onClick={generateVerb}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Dice1 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <div>
                            <Label className="text-gray-300 text-sm">Adjective</Label>
                            <div className="flex space-x-2">
                              <Input
                                value={generatedWords.adjective}
                                onChange={(e) => setGeneratedWords(prev => ({ ...prev, adjective: e.target.value }))}
                                className="bg-gray-700 border-gray-600 text-white"
                                placeholder="Generate adjective..."
                              />
                              <Button
                                type="button"
                                onClick={generateAdjective}
                                size="sm"
                                className="bg-orange-600 hover:bg-orange-700"
                              >
                                <Dice1 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="encounter" className="text-gray-300">
                        Encounter Sentence (use the generated words above)
                      </Label>
                      <Input
                        id="encounter"
                        value={newEncounter.sentence}
                        onChange={(e) => setNewEncounter({ ...newEncounter, sentence: e.target.value })}
                        className="bg-gray-700 border-gray-600 text-white"
                        placeholder="Create a sentence using the generated words..."
                      />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="difficulty" className="text-gray-300 text-sm">Difficulty</Label>
                        <Input
                          id="difficulty"
                          type="number"
                          value={newEncounter.difficulty}
                          onChange={e => setNewEncounter({ ...newEncounter, difficulty: parseInt(e.target.value) || 1 })}
                          className="bg-gray-700 border-gray-600 text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <div>
                        <Label htmlFor="length" className="text-gray-300 text-sm">Length</Label>
                        <Input
                          id="length"
                          type="number"
                          value={newEncounter.length}
                          onChange={e => setNewEncounter({ ...newEncounter, length: parseInt(e.target.value) || 1 })}
                          className="bg-gray-700 border-gray-600 text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <div>
                        <Label htmlFor="threat" className="text-gray-300 text-sm">Threat</Label>
                        <Input
                          id="threat"
                          type="number"
                          value={newEncounter.threat}
                          onChange={e => setNewEncounter({ ...newEncounter, threat: parseInt(e.target.value) || 1 })}
                          className="bg-gray-700 border-gray-600 text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>
                    
                    <div className="bg-yellow-600 bg-opacity-20 border border-yellow-400 rounded-lg p-3">
                      <div className="flex items-center space-x-2 mb-2">
                        <RefreshCw className="w-4 h-4 text-yellow-400" />
                        <span className="text-yellow-400 font-semibold">New Encounter Warning</span>
                      </div>
                      <p className="text-sm text-gray-300">
                        If you change the encounter sentence, the turn counter will reset to 1 and all pending words will be cleared.
                      </p>
                    </div>
                    
                    <Button
                      onClick={handleUpdateEncounter}
                      disabled={updateEncounterMutation.isPending}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      {updateEncounterMutation.isPending ? "Updating..." : "Update Encounter"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
