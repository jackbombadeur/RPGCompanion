import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Plus } from "lucide-react";

interface WordDictionaryProps {
  words: any[];
  sessionId: number;
  isGM: boolean;
}

export default function WordDictionary({ words, sessionId, isGM }: WordDictionaryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newWord, setNewWord] = useState({
    word: "",
    meaning: "",
    potency: 1,
    wordType: "",
  });
  const { toast } = useToast();

  const createWordMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", `/api/sessions/${sessionId}/words`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Word Created",
        description: "New word added to dictionary",
      });
      setNewWord({ word: "", meaning: "", potency: 1, wordType: "" });
      setIsAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create word",
        variant: "destructive",
      });
    },
  });

  const filteredWords = words.filter(word =>
    word.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
    word.meaning.toLowerCase().includes(searchTerm.toLowerCase())
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

  return (
    <Card className="bg-gray-700 sticky top-44">
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
                  <Badge className="bg-yellow-500 text-black">
                    {word.potency}
                  </Badge>
                </div>
                <p className="text-xs text-gray-300 mb-2">{word.meaning}</p>
                <div className="text-xs text-gray-400">
                  <span>Owner: {word.owner?.firstName || word.owner?.email || 'Unknown'}</span>
                  {word.wordType && (
                    <>
                      <span className="ml-2">•</span>
                      <span className="ml-2">Type: {word.wordType}</span>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add New Word (GM Only) */}
        {isGM && (
          <div className="pt-4 border-t border-gray-600">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full bg-purple-600 hover:bg-purple-700" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Word (GM)
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-800 border-gray-600">
                <DialogHeader>
                  <DialogTitle className="text-white">Create New Word</DialogTitle>
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
                  <div>
                    <Label htmlFor="potency" className="text-gray-300">Potency (1-10)</Label>
                    <Input
                      id="potency"
                      type="number"
                      min={1}
                      max={10}
                      value={newWord.potency}
                      onChange={(e) => setNewWord({ ...newWord, potency: parseInt(e.target.value) || 1 })}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="wordType" className="text-gray-300">Type (Optional)</Label>
                    <Input
                      id="wordType"
                      value={newWord.wordType}
                      onChange={(e) => setNewWord({ ...newWord, wordType: e.target.value })}
                      className="bg-gray-700 border-gray-600 text-white"
                      placeholder="Combat, Magic, etc."
                    />
                  </div>
                  <Button
                    onClick={handleCreateWord}
                    disabled={createWordMutation.isPending}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {createWordMutation.isPending ? "Creating..." : "Create Word"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
