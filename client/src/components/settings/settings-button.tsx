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

  // Don't show settings if no session
  if (!sessionId) {
    return null;
  }

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsOpen(true)}
        className="hover:bg-accent hover:text-accent-foreground"
        title="Settings"
      >
        <Settings className="h-4 w-4" />
        {showText && <span className="ml-2">Settings</span>}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Chat Settings</span>
            </DialogTitle>
          </DialogHeader>
          
          <UserSettingsComponent 
            sessionId={sessionId} 
            onClose={handleClose}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}