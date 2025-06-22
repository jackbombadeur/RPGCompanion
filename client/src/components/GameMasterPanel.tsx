import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Settings, Edit, BookOpen, Heart, FastForward, Crown } from "lucide-react";

interface GameMasterPanelProps {
  sessionId: number;
  players: any[];
  session: any;
}

export default function GameMasterPanel({ sessionId, players, session }: GameMasterPanelProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [encounterSentence, setEncounterSentence] = useState(session.encounterSentence || "");
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [nerveAdjustment, setNerveAdjustment] = useState(0);
  const { toast } = useToast();

  const updateEncounterMutation = useMutation({
    mutationFn: async (data: { sentence: string }) => {
      const response = await apiRequest("PATCH", `/api/sessions/${sessionId}/encounter`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Encounter Updated",
        description: "Encounter sentence has been updated",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update encounter",
        variant: "destructive",
      });
    },
  });

  const adjustNerveMutation = useMutation({
    mutationFn: async (data: { userId: string; nerve: number }) => {
      const response = await apiRequest("PATCH", `/api/sessions/${sessionId}/players/${data.userId}/nerve`, {
        nerve: data.nerve
      });
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
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to adjust nerve",
        variant: "destructive",
      });
    },
  });

  const handleUpdateEncounter = () => {
    if (!encounterSentence.trim()) {
      toast({
        title: "Invalid Encounter",
        description: "Encounter sentence cannot be empty",
        variant: "destructive",
      });
      return;
    }
    updateEncounterMutation.mutate({ sentence: encounterSentence });
  };

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
            {/* Edit Encounter */}
            <Dialog>
              <DialogTrigger asChild>
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-sm">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Encounter
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-800 border-gray-600">
                <DialogHeader>
                  <DialogTitle className="text-white">Edit Encounter</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="encounter" className="text-gray-300">
                      Encounter Sentence (3 words recommended)
                    </Label>
                    <Input
                      id="encounter"
                      value={encounterSentence}
                      onChange={(e) => setEncounterSentence(e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                      placeholder="Ancient shadows whisper"
                    />
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
                          <span>{player.user?.firstName || player.user?.email || 'Player'}</span>
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
                      <Button
                        onClick={handleAdjustNerve}
                        disabled={adjustNerveMutation.isPending}
                        className="w-full mt-2 bg-yellow-600 hover:bg-yellow-700"
                      >
                        {adjustNerveMutation.isPending ? "Adjusting..." : "Adjust Nerve"}
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Button 
              onClick={() => setIsPanelOpen(false)}
              variant="outline" 
              className="w-full text-sm border-gray-600"
            >
              Close Panel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
