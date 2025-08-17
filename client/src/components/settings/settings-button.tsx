import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Settings } from "lucide-react";
import UserSettingsComponent from "./user-settings";

interface SettingsButtonProps {
  sessionId: string | null;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  showText?: boolean;
}

export default function SettingsButton({ 
  sessionId, 
  variant = "ghost", 
  size = "icon",
  showText = false 
}: SettingsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Show settings button even without session for testing
  // if (!sessionId) {
  //   return null;
  // }

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsOpen(true)}
        className="luxury-hover w-12 h-12 rounded-2xl luxury-glass border-border/30 text-muted-foreground hover:text-primary transition-all duration-300"
        title="Luxury Settings"
      >
        <Settings className="h-5 w-5" />
        {showText && <span className="ml-2 font-luxury-sans">Settings</span>}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto luxury-glass border-border/30 luxury-shadow">
          <div className="absolute inset-0 luxury-gradient-bg opacity-5 rounded-lg"></div>
          <DialogHeader className="relative">
            <DialogTitle className="flex items-center space-x-3 font-luxury-display text-2xl">
              <div className="w-10 h-10 luxury-gradient-bg rounded-2xl flex items-center justify-center shadow-lg">
                <Settings className="h-5 w-5 text-white" />
              </div>
              <span>Luxury Experience Settings</span>
            </DialogTitle>
          </DialogHeader>
          
          <UserSettingsComponent 
            sessionId={sessionId || "demo-session"} 
            onClose={handleClose}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}