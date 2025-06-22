import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Dice1, Plus, Users, Crown } from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [sessionName, setSessionName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const createSessionMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const response = await apiRequest("POST", "/api/sessions", data);
      return response.json();
    },
    onSuccess: (session) => {
      toast({
        title: "Session Created",
        description: `Session code: ${session.code}`,
      });
      setLocation(`/session/${session.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create session",
        variant: "destructive",
      });
    },
  });

  const joinSessionMutation = useMutation({
    mutationFn: async (data: { code: string }) => {
      const response = await apiRequest("POST", "/api/sessions/join", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Joined Session",
        description: `Welcome to ${data.session.name}`,
      });
      setLocation(`/session/${data.session.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to join session. Check your code.",
        variant: "destructive",
      });
    },
  });

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName.trim()) return;
    createSessionMutation.mutate({ name: sessionName });
  };

  const handleJoinSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    joinSessionMutation.mutate({ code: joinCode.toUpperCase() });
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-800/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Dice1 className="h-8 w-8 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">Nerve Combat</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-300">
                Welcome, {user?.firstName || user?.email}
              </div>
              <Button 
                onClick={handleLogout}
                variant="destructive"
                size="sm"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">
              Ready for Battle?
            </h2>
            <p className="text-gray-300 text-lg">
              Create a new session as Game Master or join an existing battle
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Create Session */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Crown className="h-6 w-6 text-yellow-400 mr-2" />
                  Create Session (GM)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateSession} className="space-y-4">
                  <div>
                    <Label htmlFor="sessionName" className="text-gray-300">
                      Session Name
                    </Label>
                    <Input
                      id="sessionName"
                      placeholder="Epic Battle Arena..."
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    disabled={createSessionMutation.isPending}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {createSessionMutation.isPending ? "Creating..." : "Create Session"}
                  </Button>
                </form>
                <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                  <p className="text-xs text-gray-300">
                    As GM, you'll control the encounter, create words, and manage the session.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Join Session */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Users className="h-6 w-6 text-emerald-400 mr-2" />
                  Join Session
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleJoinSession} className="space-y-4">
                  <div>
                    <Label htmlFor="joinCode" className="text-gray-300">
                      Session Code
                    </Label>
                    <Input
                      id="joinCode"
                      placeholder="ABC123"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      className="bg-gray-700 border-gray-600 text-white"
                      maxLength={6}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    disabled={joinSessionMutation.isPending}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    {joinSessionMutation.isPending ? "Joining..." : "Join Battle"}
                  </Button>
                </form>
                <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                  <p className="text-xs text-gray-300">
                    Enter the 6-character code provided by your Game Master.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Game Rules */}
          <div className="mt-16">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-center">Quick Rules</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-6 text-gray-300">
                <div className="text-center">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-white font-bold">8</span>
                  </div>
                  <h3 className="font-semibold mb-2">Start with 8 Nerve</h3>
                  <p className="text-sm">Your health and initiative. Higher nerve goes first in combat.</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <BookOpen className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2">Create Words</h3>
                  <p className="text-sm">Lose nerve equal to word potency, but gain combat power.</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Dice1 className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2">Roll 2d6 + Potency</h3>
                  <p className="text-sm">Use your words in sentences to boost your combat rolls.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
