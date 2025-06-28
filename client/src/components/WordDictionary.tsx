import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { BookOpen, Plus, Clock, CheckCircle } from "lucide-react";

interface WordDictionaryProps {
  words: any[];
  sessionId: number;
  isGM: boolean;
  isActivePlayer: boolean;
  players: any[];
}

export default function WordDictionary({ words, sessionId, isGM, isActivePlayer, players }: WordDictionaryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [newWord, setNewWord] = useState({
    word: "",
    meaning: "",
  });
  const [selectedWord, setSelectedWord] = useState<any>(null);
  const [potency, setPotency] = useState(1);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch pending words for GM
  const { data: pendingWords = [] } = useQuery({
    queryKey: ['/api/sessions', sessionId, 'pending-words'],
    queryFn: async () => {
      if (!isGM) return [];
      const response = await apiRequest("GET", `/api/sessions/${sessionId}/words/pending?userId=${user?.id}`);
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
    onSuccess: () => {
      toast({
        title: "Word Created",
        description: "Word submitted for GM approval",
      });
      setNewWord({ word: "", meaning: "" });
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
    onSuccess: () => {
      toast({
        title: "Word Approved",
        description: "Word has been approved and added to dictionary",
      });
      setSelectedWord(null);
      setPotency(1);
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

  const handleCreateWord = () => {
    if (!newWord.word.trim() || !newWord.meaning.trim()) {
      toast({
        title: "Invalid Word",
        description: "Word and meaning are required",
        variant: "destructive",
      });
      return;
    }

    createWordMutation.mutate(newWord);
  };

  const handleApproveWord = () => {
    if (!selectedWord || potency < 1 || potency > 10) {
      toast({
        title: "Invalid Potency",
        description: "Potency must be between 1 and 10",
        variant: "destructive",
      });
      return;
    }

    approveWordMutation.mutate({ wordId: selectedWord.id, potency });
  };

  const getPlayerName = (ownerId: string) => {
    const player = players.find(p => p.userId === ownerId);
    const playerName = player?.playerName || player?.user?.firstName || player?.user?.email || 'Unknown';
    // Add "(You)" indicator if this is the current user's word
    const isCurrentUser = player?.userId === user?.id;
    return isCurrentUser ? `${playerName} (You)` : playerName;
  };

  return (
    <Card className="bg-gray-700 sticky top-52">
      <CardHeader>
        <CardTitle className="flex items-center text-white">
          <BookOpen className="mr-2 text-purple-400" />
          Word Dictionary
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
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredWords.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No words found</p>
          ) : (
            filteredWords.map((word) => (
              <div key={word.id} className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-purple-400 text-sm">
                    {word.word}
                  </span>
                  <div className="flex items-center space-x-2">
                    {word.potency === null ? (
                      <Badge className="bg-yellow-600 text-white">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                    ) : (
                      <Badge className="bg-yellow-500 text-black">
                        {word.potency}
                      </Badge>
                    )}
                    {word.isApproved && (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-300 mb-2">{word.meaning}</p>
                <div className="text-xs text-gray-400">
                  <span>Owner: {getPlayerName(word.ownerId)}</span>
                </div>
              </div>
            ))
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
              <DialogContent className="bg-gray-800 border-gray-600">
                <DialogHeader>
                  <DialogTitle className="text-white">Define New Word</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="word" className="text-gray-300">Word</Label>
                    <Input
                      id="word"
                      value={newWord.word}
                      onChange={(e) => setNewWord({ ...newWord, word: e.target.value })}
                      className="bg-gray-700 border-gray-600 text-white"
                      placeholder="shadowstrike"
                    />
                  </div>
                  <div>
                    <Label htmlFor="meaning" className="text-gray-300">Meaning</Label>
                    <Textarea
                      id="meaning"
                      value={newWord.meaning}
                      onChange={(e) => setNewWord({ ...newWord, meaning: e.target.value })}
                      className="bg-gray-700 border-gray-600 text-white"
                      placeholder="A swift, stealthy attack from darkness"
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    GM will set the potency value after reviewing your word.
                  </p>
                  <Button
                    onClick={handleCreateWord}
                    disabled={createWordMutation.isPending}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {createWordMutation.isPending ? "Creating..." : "Submit Word"}
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
              <DialogContent className="bg-gray-800 border-gray-600">
                <DialogHeader>
                  <DialogTitle className="text-white">Review Pending Words</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {pendingWords.map((word: any) => (
                    <div key={word.id} className="bg-gray-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-purple-400">{word.word}</span>
                        <span className="text-xs text-gray-400">
                          by {getPlayerName(word.ownerId)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 mb-3">{word.meaning}</p>
                      <div className="flex items-center space-x-2">
                        <Label htmlFor={`potency-${word.id}`} className="text-gray-300 text-sm">
                          Potency:
                        </Label>
                        <Input
                          id={`potency-${word.id}`}
                          type="number"
                          min={1}
                          max={10}
                          value={selectedWord?.id === word.id ? potency : 1}
                          onChange={(e) => {
                            if (selectedWord?.id === word.id) {
                              setPotency(parseInt(e.target.value) || 1);
                            }
                          }}
                          className="w-20 bg-gray-600 border-gray-500 text-white"
                        />
                        <Button
                          onClick={() => {
                            setSelectedWord(word);
                            setPotency(1);
                          }}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Select
                        </Button>
                      </div>
                    </div>
                  ))}
                  {selectedWord && (
                    <div className="bg-green-600 bg-opacity-20 border border-green-400 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-green-400">Selected: {selectedWord.word}</span>
                      </div>
                      <p className="text-sm text-gray-300 mb-3">{selectedWord.meaning}</p>
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="final-potency" className="text-gray-300 text-sm">
                          Set Potency:
                        </Label>
                        <Input
                          id="final-potency"
                          type="number"
                          min={1}
                          max={10}
                          value={potency}
                          onChange={(e) => setPotency(parseInt(e.target.value) || 1)}
                          className="w-20 bg-gray-600 border-gray-500 text-white"
                        />
                        <Button
                          onClick={handleApproveWord}
                          disabled={approveWordMutation.isPending}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {approveWordMutation.isPending ? "Approving..." : "Approve"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
