import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Edit, RefreshCw } from "lucide-react";

interface EncounterHeaderProps {
  encounterSentence?: string | null;
  isGM?: boolean;
  onUpdateEncounter?: (sentence: string) => void;
}

export default function EncounterHeader({ encounterSentence, isGM, onUpdateEncounter }: EncounterHeaderProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEncounter, setNewEncounter] = useState(encounterSentence || "");
  const { toast } = useToast();
  const { user } = useAuth();

  const updateEncounterMutation = useMutation({
    mutationFn: async (data: { sentence: string }) => {
      const response = await apiRequest("PATCH", `/api/sessions/${window.location.pathname.split('/').pop()}/encounter`, {
        userId: user?.id,
        sentence: data.sentence,
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
          description: "Encounter sentence has been updated",
        });
      }
      setIsDialogOpen(false);
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
    if (!newEncounter.trim()) {
      toast({
        title: "Invalid Encounter",
        description: "Encounter sentence cannot be empty",
        variant: "destructive",
      });
      return;
    }
    updateEncounterMutation.mutate({ sentence: newEncounter });
  };

  return (
    <div className="w-full bg-purple-600 border-b border-purple-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-between">
          <div className="flex-1 text-center">
            <h2 className="text-base font-semibold text-white mb-1">Current Encounter</h2>
            <div className="bg-purple-700 rounded-lg p-2">
              <p className="text-lg font-bold text-white">
                {encounterSentence || "No encounter set"}
              </p>
              <p className="text-purple-200 text-xs mt-1">GM's Encounter Words</p>
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
                    <div>
                      <Label htmlFor="encounter" className="text-gray-300">
                        Encounter Sentence (3 words recommended)
                      </Label>
                      <Input
                        id="encounter"
                        value={newEncounter}
                        onChange={(e) => setNewEncounter(e.target.value)}
                        className="bg-gray-700 border-gray-600 text-white"
                        placeholder="Ancient shadows whisper"
                      />
                    </div>
                    <div className="bg-yellow-600 bg-opacity-20 border border-yellow-400 rounded-lg p-3">
                      <div className="flex items-center space-x-2 mb-2">
                        <RefreshCw className="w-4 h-4 text-yellow-400" />
                        <span className="text-yellow-400 font-semibold">New Encounter Warning</span>
                      </div>
                      <p className="text-sm text-gray-300">
                        If you change the encounter, the turn counter will reset to 1 and all pending words will be cleared.
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
