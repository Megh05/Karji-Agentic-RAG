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
    
    // Only show one follow-up at a time and ensure unique keys
    if (newFollowUps.length > 0) {
      const followUp = newFollowUps[0];
      const uniqueId = `${followUp.id}_${conversationLength}_${Date.now()}`;
      
      if (![...shownFollowUps].includes(followUp.trigger)) {
        // Clear previous follow-ups and show new one after system response is fully displayed
        setTimeout(() => {
          setActiveFollowUps([{ ...followUp, id: uniqueId }]);
          setShownFollowUps(prev => new Set([...prev, followUp.trigger]));
        }, 3500); // Increased delay to 3.5 seconds to ensure system response is fully displayed
      }
    }

  }, [conversationLength]);

  const generateFollowUps = (): ContextualFollowUp[] => {
    const followUps: ContextualFollowUp[] = [];

    // Show different follow-ups based on conversation length and context
    if (conversationLength === 2) {
      followUps.push({
        id: 'welcome_help',
        type: 'recommendation',
        trigger: 'initial_help',
        message: "I can help you find exactly what you're looking for. What's most important to you?",
        timing: 0,
        priority: 'medium',
        actions: ['Show me perfumes', 'I want to see watches', 'Browse fragrances for men', 'I\'m looking for women\'s perfumes']
      });
    } else if (conversationLength === 4) {
      followUps.push({
        id: 'discovery_help',
        type: 'recommendation',
        trigger: 'discovery_assist',
        message: "Would you like me to show you some curated collections or help filter products?",
        timing: 0,
        priority: 'medium',
        actions: ['Show me popular perfumes', 'I want luxury fragrances', 'Browse budget-friendly options', 'I need gift recommendations']
      });
    } else if (conversationLength === 6) {
      followUps.push({
        id: 'personalized_help',
        type: 'recommendation',
        trigger: 'personalization',
        message: "Based on our conversation, would you like me to create a personalized recommendation list?",
        timing: 0,
        priority: 'high',
        actions: ['I prefer floral scents', 'I like woody/musky fragrances', 'I want something for everyday wear', 'I\'m looking for special occasion perfume']
      });
    } else if (conversationLength === 8) {
      followUps.push({
        id: 'purchase_assist',
        type: 'offer',
        trigger: 'purchase_guidance',
        message: "Ready to make a decision? I can help with final comparisons or special offers.",
        timing: 0,
        priority: 'high',
        actions: ['Compare Options', 'Check Special Offers', 'Purchase Assistance']
      });
    } else if (conversationLength > 9) {
      followUps.push({
        id: 'closing_help',
        type: 'recommendation',
        trigger: 'closing_assistance',
        message: "Is there anything specific I can help you decide on or any questions about our products?",
        timing: 0,
        priority: 'medium',
        actions: ['Final Questions', 'Product Details', 'Purchase Support']
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
    // Remove the follow-up after clicking the message
    setActiveFollowUps(prev => prev.filter(f => f.id !== followUp.id));
    onFollowUpClick?.(followUp);
  };

  const handleActionClick = (action: string, followUp: ContextualFollowUp) => {
    console.log('Action clicked:', action, followUp);
    // Remove the follow-up after action is clicked
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
        <div 
          key={followUp.id} 
          className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
        >
          <div className="flex items-center space-x-2 mb-2">
            {getIcon(followUp.type)}
            <p 
              className="text-sm text-gray-700 dark:text-gray-300 flex-1 cursor-pointer hover:text-primary"
              onClick={() => handleFollowUpClick(followUp)}
            >
              {followUp.message}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {followUp.actions?.map((action, index) => (
              <button
                key={`${followUp.id}-${index}`}
                className="px-3 py-1 text-xs bg-primary text-white rounded-md hover:bg-primary/90 transition-colors cursor-pointer"
                onClick={() => {
                  console.log('Action button clicked:', action);
                  handleActionClick(action, followUp);
                }}
              >
                {action}
              </button>
            ))}
            
            <button
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
              onClick={() => dismissFollowUp(followUp.id)}
            >
              ✕ Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}