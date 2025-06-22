import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from "lucide-react";

interface DiceRollerProps {
  onRoll: (dice: number[]) => void;
  potency: number;
  disabled?: boolean;
}

const diceIcons = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

export default function DiceRoller({ onRoll, potency, disabled }: DiceRollerProps) {
  const [diceResults, setDiceResults] = useState<number[]>([]);
  const [isRolling, setIsRolling] = useState(false);

  const rollDice = () => {
    setIsRolling(true);
    
    // Simulate rolling animation
    setTimeout(() => {
      const dice1 = Math.floor(Math.random() * 6) + 1;
      const dice2 = Math.floor(Math.random() * 6) + 1;
      const results = [dice1, dice2];
      
      setDiceResults(results);
      setIsRolling(false);
      onRoll(results);
    }, 500);
  };

  const diceTotal = diceResults.reduce((sum, die) => sum + die, 0);
  const finalResult = diceTotal + potency;

  const DiceIcon1 = diceResults[0] ? diceIcons[diceResults[0] - 1] : Dice1;
  const DiceIcon2 = diceResults[1] ? diceIcons[diceResults[1] - 1] : Dice1;

  return (
    <Card className="bg-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center text-white">
          <Dice1 className="mr-2 text-purple-400" />
          Dice Rolling (2d6 + Potency)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="text-center">
            <div className="bg-gray-800 rounded-lg p-6 mb-4">
              <div className="text-6xl mb-4 flex justify-center space-x-2">
                <DiceIcon1 
                  className={`text-yellow-400 ${isRolling ? 'animate-spin' : ''}`} 
                />
                <DiceIcon2 
                  className={`text-yellow-400 ${isRolling ? 'animate-spin' : ''}`} 
                />
              </div>
              {diceResults.length > 0 && (
                <p className="text-sm text-gray-300">
                  Last Roll: <span className="text-white font-semibold">
                    {diceResults.join(' + ')} = {diceTotal}
                  </span>
                </p>
              )}
            </div>
            <Button
              onClick={rollDice}
              disabled={disabled || isRolling}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              <Dice1 className="mr-2 h-4 w-4" />
              {isRolling ? "Rolling..." : "Roll 2d6"}
            </Button>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="font-semibold mb-3 text-white">Roll Calculation</h4>
            <div className="space-y-2 text-sm text-gray-300">
              <div className="flex justify-between">
                <span>Dice Total:</span>
                <span className="font-semibold text-white">
                  {diceResults.length > 0 ? diceTotal : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Word Potency:</span>
                <span className="font-semibold text-purple-400">+{potency}</span>
              </div>
              <div className="border-t border-gray-600 pt-2 flex justify-between">
                <span className="font-semibold">Final Result:</span>
                <span className="font-bold text-emerald-400 text-lg">
                  {diceResults.length > 0 ? finalResult : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
