import { Button } from "@/components/ui/button";
import { Dice1, LogOut } from "lucide-react";
import { useLocation } from "wouter";

interface AppHeaderProps {
  session: {
    id: number;
    code: string;
    name: string;
  };
}

export default function AppHeader({ session }: AppHeaderProps) {
  const [, setLocation] = useLocation();

  const handleLeaveSession = () => {
    setLocation("/");
  };

  return (
    <header className="bg-gray-800 border-b border-gray-600 fixed top-0 w-full z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <Dice1 className="text-purple-400 text-2xl" />
            <h1 className="text-xl font-bold text-white">TTRPG Session Manager</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-300">
              <span>Session: {session.code}</span>
            </div>
            <Button 
              onClick={handleLeaveSession}
              variant="destructive"
              size="sm"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Leave Session
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
