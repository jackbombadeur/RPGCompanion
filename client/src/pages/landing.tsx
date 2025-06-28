import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dice1, Users, Sword, BookOpen } from "lucide-react";

export default function Landing() {
  const [sessionCode, setSessionCode] = useState("");

  const handleEnterGame = () => {
    // Create a temporary user to get past authentication
    const tempUser = {
      id: `temp-${Date.now()}`,
      email: "demo@example.com",
      firstName: "Demo",
      lastName: "User",
      profileImageUrl: null,
    };
    
    // Store in localStorage to pass authentication check
    localStorage.setItem('currentUser', JSON.stringify(tempUser));
    
    // Redirect to home page
    window.location.href = "/";
  };

  const handleJoinWithCode = () => {
    if (sessionCode.trim()) {
      // If they have a session code, redirect to home with the code pre-filled
      localStorage.setItem('prefillJoinCode', sessionCode.toUpperCase());
      handleEnterGame();
    } else {
      handleEnterGame();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-8">
            <Dice1 className="h-16 w-16 text-purple-400 mr-4" />
            <h1 className="text-6xl font-bold text-white">
              Sky Block Rivals
            </h1>
          </div>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
          A mini competitive TTRPG for 1 Bookworm (the referee) & 2-4 other Players.
          You'll only need some D6 dice, some writing supplies, and a few hours.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <Users className="h-8 w-8 text-emerald-400 mb-2" />
              <CardTitle className="text-white">Multiplayer Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">
                Up to 5 players per session with one Game Master controlling the encounter and word creation.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <Sword className="h-8 w-8 text-red-400 mb-2" />
              <CardTitle className="text-white">Nerve-Based Combat</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">
                Start with 8 nerve points. Lose nerve when creating words, but gain combat potency through ownership.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <BookOpen className="h-8 w-8 text-blue-400 mb-2" />
              <CardTitle className="text-white">Word Dictionary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">
                Create and define words with potency values. Use your words in combat sentences for dice roll bonuses.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Login Section */}
        <div className="max-w-md mx-auto">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-center">Join the Battle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sessionCode" className="text-gray-300">
                  Have a session code? (Optional)
                </Label>
                <Input
                  id="sessionCode"
                  placeholder="Enter session code..."
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <Button 
                onClick={handleJoinWithCode}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                Enter Game (Demo Mode)
              </Button>
              <p className="text-xs text-gray-400 text-center">
                Demo mode - no authentication required
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Game Rules Summary */}
        <div className="mt-16 max-w-4xl mx-auto">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-center">How to Play</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-purple-400 mb-2">Setup</h3>
                  <ul className="space-y-1 text-sm">
                    <li>• Each player starts with 8 nerve points</li>
                    <li>• GM creates encounter with 3-word sentence</li>
                    <li>• Players create words by losing nerve equal to potency</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-purple-400 mb-2">Combat</h3>
                  <ul className="space-y-1 text-sm">
                    <li>• Turn order based on current nerve (highest first)</li>
                    <li>• Create sentences using 2-3 owned words minimum</li>
                    <li>• Roll 2d6 + combined word potency</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
