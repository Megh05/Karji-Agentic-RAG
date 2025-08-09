import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Zap, Gift, ShoppingBag, Star, AlertCircle } from "lucide-react";

interface ContextualFollowUp {
  id: string;
  type: 'urgency' | 'offer' | 'recommendation' | 'social_proof' | 'nudge';
  trigger: string;
  message: string;
  timing: number;
  priority: 'low' | 'medium' | 'high';
  actions?: string[];
  expiresAt?: Date;
}

interface ContextualFollowUpsProps {
  sessionId: string;
  conversationLength: number;
  userProfile?: any;
  onFollowUpClick?: (followUp: ContextualFollowUp) => void;
  onActionClick?: (action: string) => void;
}

export default function ContextualFollowUps({
  sessionId,
  conversationLength,
  userProfile,
  onFollowUpClick,
  onActionClick
}: ContextualFollowUpsProps) {
  const [activeFollowUps, setActiveFollowUps] = useState<ContextualFollowUp[]>([]);
  const [shownFollowUps, setShownFollowUps] = useState<Set<string>>(new Set());

  // Generate contextual follow-ups based on conversation state
  useEffect(() => {
    // Clear existing follow-ups first
    setActiveFollowUps([]);
    
    const newFollowUps = generateFollowUps();
    
    // Only show one follow-up at a time and ensure unique keys
    if (newFollowUps.length > 0) {
      const followUp = newFollowUps[0];
      const uniqueId = `${followUp.id}_${conversationLength}_${Date.now()}`;
      
      if (!shownFollowUps.has(followUp.trigger)) {
        setTimeout(() => {
          setActiveFollowUps([{ ...followUp, id: uniqueId }]);
          setShownFollowUps(prev => new Set([...prev, followUp.trigger]));
        }, followUp.timing * 1000);
      }
    }

  }, [conversationLength]);

  const generateFollowUps = (): ContextualFollowUp[] => {
    const followUps: ContextualFollowUp[] = [];

    // Only show one relevant follow-up based on conversation context
    if (conversationLength > 5) {
      followUps.push({
        id: 'smart_suggestion',
        type: 'recommendation',
        trigger: 'conversation_context',
        message: "Based on our conversation, would you like me to create a personalized recommendation list?",
        timing: 0,
        priority: 'high',
        actions: ['Create Personal List', 'Show Best Matches', 'Get Expert Picks']
      });
    } else if (conversationLength > 3) {
      followUps.push({
        id: 'help_narrow',
        type: 'recommendation',
        trigger: 'browsing_help',
        message: "I can help you find exactly what you're looking for. What's most important to you?",
        timing: 0,
        priority: 'medium',
        actions: ['Price Range', 'Brand Preference', 'Style/Type']
      });
    }

    return followUps;
  };

  const getIcon = (type: ContextualFollowUp['type']) => {
    switch (type) {
      case 'urgency': return <Zap className="w-4 h-4 text-orange-500" />;
      case 'offer': return <Gift className="w-4 h-4 text-green-500" />;
      case 'recommendation': return <Star className="w-4 h-4 text-blue-500" />;
      case 'social_proof': return <ShoppingBag className="w-4 h-4 text-purple-500" />;
      case 'nudge': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: ContextualFollowUp['priority']) => {
    switch (priority) {
      case 'high': return 'border-red-200 bg-red-50 dark:bg-red-900/20';
      case 'medium': return 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20';
      case 'low': return 'border-blue-200 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  const handleFollowUpClick = (followUp: ContextualFollowUp) => {
    // Remove the follow-up after clicking
    setActiveFollowUps(prev => prev.filter(f => f.id !== followUp.id));
    onFollowUpClick?.(followUp);
  };

  const handleActionClick = (action: string, followUp: ContextualFollowUp) => {
    // Remove the follow-up after action
    setActiveFollowUps(prev => prev.filter(f => f.id !== followUp.id));
    onActionClick?.(action);
  };

  const dismissFollowUp = (followUpId: string) => {
    setActiveFollowUps(prev => prev.filter(f => f.id !== followUpId));
  };

  if (activeFollowUps.length === 0) return null;

  return (
    <div className="space-y-3">
      {activeFollowUps.map((followUp) => (
        <Card 
          key={followUp.id} 
          className={`${getPriorityColor(followUp.priority)} border-l-4 shadow-sm animate-slide-in-bottom`}
        >
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-1">
                {getIcon(followUp.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="text-xs">
                    {followUp.type.replace('_', ' ').toUpperCase()}
                  </Badge>
                  
                  {followUp.expiresAt && (
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="w-3 h-3 mr-1" />
                      {Math.round((followUp.expiresAt.getTime() - Date.now()) / 60000)}m left
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  {followUp.message}
                </p>
                
                <div className="flex flex-wrap gap-2">
                  {followUp.actions?.map((action, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => handleActionClick(action, followUp)}
                    >
                      {action}
                    </Button>
                  ))}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 text-gray-500 hover:text-gray-700"
                    onClick={() => dismissFollowUp(followUp.id)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}