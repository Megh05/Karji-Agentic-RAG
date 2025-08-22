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
        className="btn-cardboard w-12 h-12 rounded-2xl icon-3d"
        title="Settings"
      >
        <Settings className="h-5 w-5" />
        {showText && <span className="ml-2">Settings</span>}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="modal-3d max-w-5xl max-h-[90vh] overflow-y-auto cardboard-responsive-padding">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3 luxury-text text-2xl">
              <Settings className="h-6 w-6 icon-3d" />
              <span>KarjiStore Settings</span>
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