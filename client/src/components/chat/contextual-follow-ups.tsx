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
    const newFollowUps = generateFollowUps();
    
    // Filter out already shown follow-ups and apply timing
    const pendingFollowUps = newFollowUps.filter(followUp => 
      !shownFollowUps.has(followUp.id)
    );

    pendingFollowUps.forEach(followUp => {
      setTimeout(() => {
        if (!shownFollowUps.has(followUp.id)) {
          setActiveFollowUps(prev => [...prev, followUp]);
          setShownFollowUps(prev => new Set([...prev, followUp.id]));
        }
      }, followUp.timing * 1000);
    });

  }, [conversationLength, userProfile]);

  const generateFollowUps = (): ContextualFollowUp[] => {
    const followUps: ContextualFollowUp[] = [];

    // Browsing hesitation trigger
    if (conversationLength > 3 && !userProfile?.recentPurchaseIntent) {
      followUps.push({
        id: 'browsing_hesitation',
        type: 'nudge',
        trigger: 'browsing_pattern',
        message: "I can help narrow down your options! Would you like me to show you our most popular items in your preferred category?",
        timing: 30,
        priority: 'medium',
        actions: ['Show Popular Items', 'Filter by Preference', 'Get Recommendations']
      });
    }

    // High engagement opportunity
    if (conversationLength > 5 && userProfile?.enthusiasmLevel > 0.7) {
      followUps.push({
        id: 'high_engagement',
        type: 'offer',
        trigger: 'engagement_spike',
        message: "You seem really interested! I can offer you an exclusive 15% discount if you decide today.",
        timing: 20,
        priority: 'high',
        actions: ['Apply Discount', 'View Exclusive Items', 'Add to Cart'],
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      });
    }

    // Price sensitivity response
    if (userProfile?.priceObjections) {
      followUps.push({
        id: 'price_alternative',
        type: 'recommendation',
        trigger: 'price_concern',
        message: "I understand budget is important. Let me show you our best value options with similar quality.",
        timing: 5,
        priority: 'high',
        actions: ['Show Budget Options', 'Compare Value', 'Apply Coupon']
      });
    }

    // Urgency creation
    if (userProfile?.urgencyLevel > 0.6) {
      followUps.push({
        id: 'urgency_stocks',
        type: 'urgency',
        trigger: 'stock_alert',
        message: "Quick update: Some of the items you're viewing have limited stock. Would you like me to check availability?",
        timing: 15,
        priority: 'high',
        actions: ['Check Stock', 'Reserve Item', 'Quick Order']
      });
    }

    // Gift opportunity
    if (userProfile?.giftIntent) {
      followUps.push({
        id: 'gift_service',
        type: 'recommendation',
        trigger: 'gift_context',
        message: "Shopping for a gift? I can help with gift wrapping and include a personalized message!",
        timing: 8,
        priority: 'medium',
        actions: ['Gift Options', 'Add Gift Wrap', 'Write Message']
      });
    }

    // Social proof boost
    if (conversationLength > 2) {
      followUps.push({
        id: 'social_proof',
        type: 'social_proof',
        trigger: 'popularity',
        message: "These items you're looking at are trending! 50+ people viewed them in the last hour.",
        timing: 25,
        priority: 'low',
        actions: ['See Why Popular', 'Join Trend', 'Get Updates']
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