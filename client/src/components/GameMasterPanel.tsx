import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Settings, BookOpen, Heart, Crown, Users, Edit } from "lucide-react";

interface GameMasterPanelProps {
  sessionId: number;
  players: any[];
  currentUser: any;
  vowels: string[];
}

export default function GameMasterPanel({ sessionId, players, currentUser, vowels }: GameMasterPanelProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [nerveAdjustment, setNerveAdjustment] = useState(0);
  const [isVowelsDialogOpen, setIsVowelsDialogOpen] = useState(false);
  const [editingVowels, setEditingVowels] = useState<string[]>([...vowels]);
  const { toast } = useToast();
  const { user } = useAuth();

  const adjustNerveMutation = useMutation({
    mutationFn: async (data: { userId: string; nerve: number }) => {
      const response = await apiRequest("PATCH", `/api/sessions/${sessionId}/players/${data.userId}/nerve`, {
        nerve: data.nerve,
        userId: user?.id,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to adjust nerve");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Nerve Adjusted",
        description: "Player nerve has been updated",
      });
      setSelectedPlayer(null);
      setNerveAdjustment(0);
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to adjust nerve",
        variant: "destructive",
      });
    },
  });

  const updateVowelsMutation = useMutation({
    mutationFn: async (data: { vowels: string[] }) => {
      const response = await apiRequest("PATCH", `/api/sessions/${sessionId}/vowels`, {
        vowels: data.vowels,
        userId: user?.id,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update vowels");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Vowels Updated",
        description: "Session vowels have been updated",
      });
      setIsVowelsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update vowels",
        variant: "destructive",
      });
    },
  });

  const handleAdjustNerve = () => {
    if (!selectedPlayer || nerveAdjustment < 0 || nerveAdjustment > 8) {
      toast({
        title: "Invalid Adjustment",
        description: "Nerve must be between 0 and 8",
        variant: "destructive",
      });
      return;
    }
    adjustNerveMutation.mutate({ 
      userId: selectedPlayer.userId, 
      nerve: nerveAdjustment 
    });
  };

  const handleUpdateVowels = () => {
    if (editingVowels.length !== 6 || editingVowels.some(v => !v.trim())) {
      toast({
        title: "Invalid Vowels",
        description: "You must provide exactly 6 non-empty vowels",
        variant: "destructive",
      });
      return;
    }
    updateVowelsMutation.mutate({ vowels: editingVowels });
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-lg"
        title="Game Master Controls"
      >
        <Settings className="h-6 w-6" />
      </Button>

      {isPanelOpen && (
        <div className="absolute bottom-16 right-0 bg-gray-700 rounded-xl p-4 w-80 shadow-xl border border-gray-600">
          <h4 className="font-semibold mb-3 flex items-center text-white">
            <Crown className="mr-2 text-yellow-400" />
            Game Master Controls
          </h4>

          <div className="space-y-3">
            {/* Edit Vowels */}
            <Dialog open={isVowelsDialogOpen} onOpenChange={setIsVowelsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-sm">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Vowels
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-800 border-gray-600">
                <DialogHeader>
                  <DialogTitle className="text-white">Edit Session Vowels</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-gray-300">
                    Define the 6 vowels that players will use to generate words. These are used in the dice-based word generation system.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {editingVowels.map((vowel, index) => (
                      <div key={index}>
                        <Label htmlFor={`vowel-${index}`} className="text-gray-300 text-sm">
                          Vowel {index + 1}
                        </Label>
                        <Input
                          id={`vowel-${index}`}
                          value={vowel}
                          onChange={(e) => {
                            const newVowels = [...editingVowels];
                            newVowels[index] = e.target.value;
                            setEditingVowels(newVowels);
                          }}
                          className="bg-gray-700 border-gray-600 text-white"
                          placeholder={`Vowel ${index + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="bg-gray-700 rounded-lg p-3">
                    <Label className="text-gray-300 text-sm mb-2 block">Current Vowels</Label>
                    <div className="flex flex-wrap gap-2">
                      {editingVowels.map((vowel, index) => (
                        <Badge key={index} className="bg-purple-600 text-white">
                          {index + 1}: {vowel || 'Empty'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={handleUpdateVowels}
                    disabled={updateVowelsMutation.isPending}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {updateVowelsMutation.isPending ? "Updating..." : "Update Vowels"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Adjust Player Nerve */}
            <Dialog>
              <DialogTrigger asChild>
                <Button className="w-full bg-yellow-600 hover:bg-yellow-700 text-sm">
                  <Heart className="mr-2 h-4 w-4" />
                  Adjust Player Nerve
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-800 border-gray-600">
                <DialogHeader>
                  <DialogTitle className="text-white">Adjust Player Nerve</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-gray-300">
                    Manually adjust player nerve values. Note: Word approval also affects nerve automatically based on potency.
                  </p>
                  <div>
                    <Label className="text-gray-300">Select Player</Label>
                    <div className="space-y-2">
                      {players.map((player) => (
                        <Button
                          key={player.id}
                          onClick={() => {
                            setSelectedPlayer(player);
                            setNerveAdjustment(player.nerve);
                          }}
                          variant={selectedPlayer?.id === player.id ? "default" : "outline"}
                          className="w-full justify-between"
                        >
                          <span>{player.playerName || player.user?.firstName || player.user?.email || 'Player'}</span>
                          <span>Nerve: {player.nerve}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                  {selectedPlayer && (
                    <div>
                      <Label htmlFor="nerve" className="text-gray-300">
                        New Nerve Value (0-8)
                      </Label>
                      <Input
                        id="nerve"
                        type="number"
                        min={0}
                        max={8}
                        value={nerveAdjustment}
                        onChange={(e) => setNerveAdjustment(parseInt(e.target.value) || 0)}
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                  )}
                  <Button
                    onClick={handleAdjustNerve}
                    disabled={adjustNerveMutation.isPending || !selectedPlayer}
                    className="w-full bg-yellow-600 hover:bg-yellow-700"
                  >
                    {adjustNerveMutation.isPending ? "Adjusting..." : "Adjust Nerve"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}
    </div>
  );
}
