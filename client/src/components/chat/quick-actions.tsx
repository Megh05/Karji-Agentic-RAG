import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Filter, 
  ShoppingCart, 
  Heart, 
  Share2, 
  Clock,
  Gift,
  Truck,
  Search,
  Tag,
  Sparkles,
  Zap,
  GitCompare
} from "lucide-react";

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  category: 'shopping' | 'discovery' | 'service' | 'social';
  priority: number;
  context?: string[];
  requiresProducts?: boolean;
}

interface QuickActionsProps {
  products?: any[];
  userProfile?: any;
  conversationContext?: string;
  onActionClick?: (action: QuickAction, context?: any) => void;
}

export default function QuickActions({
  products = [],
  userProfile,
  conversationContext,
  onActionClick
}: QuickActionsProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const allActions: QuickAction[] = [
    // Core Discovery Actions (always relevant)
    {
      id: 'smart_filter',
      label: 'Filter',
      icon: <Filter className="w-4 h-4" />,
      category: 'discovery',
      priority: 9
    },
    {
      id: 'check_deals',
      label: 'Deals',
      icon: <Tag className="w-4 h-4" />,
      category: 'discovery',
      priority: 8
    },
    {
      id: 'trending_now',
      label: 'Trending',
      icon: <Zap className="w-4 h-4" />,
      category: 'discovery',
      priority: 7
    },
    {
      id: 'personalized_recommendations',
      label: 'For You',
      icon: <Sparkles className="w-4 h-4" />,
      category: 'discovery',
      priority: 8
    },

    // Conditional Product Actions
    {
      id: 'similar_products',
      label: 'Similar',
      icon: <Search className="w-4 h-4" />,
      category: 'discovery',
      priority: 6,
      requiresProducts: true
    },
    {
      id: 'compare_products',
      label: 'Compare',
      icon: <GitCompare className="w-4 h-4" />,
      category: 'shopping',
      priority: 7,
      requiresProducts: true
    },

    // Service Actions
    {
      id: 'delivery_info',
      label: 'Shipping',
      icon: <Truck className="w-4 h-4" />,
      category: 'service',
      priority: 5
    },
    {
      id: 'help_me_choose',
      label: 'Help Choose',
      icon: <Heart className="w-4 h-4" />,
      category: 'service',
      priority: 6
    }
  ];

  const getRelevantActions = (): QuickAction[] => {
    let relevantActions = allActions.filter(action => {
      // Filter by product requirement
      if (action.requiresProducts && products.length === 0) {
        return false;
      }

      // Filter by context if available
      if (action.context && userProfile) {
        const hasRelevantContext = action.context.some(ctx => {
          switch (ctx) {
            case 'price_sensitive':
              return userProfile.priceObjections || userProfile.budgetConscious;
            case 'budget_conscious':
              return userProfile.behaviorPatterns?.browsingStyle === 'price_conscious';
            case 'browsing':
              return conversationContext?.includes('browsing') || conversationContext?.includes('looking');
            case 'exploring':
              return conversationContext?.includes('show me') || conversationContext?.includes('explore');
            case 'returning_user':
              return userProfile.behaviorPatterns?.messageFrequency > 1;
            case 'high_engagement':
              return userProfile.emotionalProfile?.enthusiasmLevel > 0.7;
            case 'gift_intent':
              return conversationContext?.includes('gift') || conversationContext?.includes('present');
            case 'special_occasion':
              return conversationContext?.includes('birthday') || conversationContext?.includes('anniversary');
            case 'urgency':
              return userProfile.emotionalProfile?.urgencyLevel > 0.6;
            case 'shipping_inquiry':
              return conversationContext?.includes('delivery') || conversationContext?.includes('shipping');
            default:
              return false;
          }
        });
        
        if (!hasRelevantContext) return false;
      }

      return true;
    });

    // Sort by priority and return top actions
    return relevantActions
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 8);
  };

  const groupedActions = getRelevantActions().reduce((groups, action) => {
    if (!groups[action.category]) {
      groups[action.category] = [];
    }
    groups[action.category].push(action);
    return groups;
  }, {} as Record<string, QuickAction[]>);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'shopping': return <ShoppingCart className="w-4 h-4" />;
      case 'discovery': return <Search className="w-4 h-4" />;
      case 'service': return <Truck className="w-4 h-4" />;
      case 'social': return <Share2 className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'shopping': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'discovery': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'service': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'social': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const handleActionClick = (action: QuickAction) => {
    const context = {
      products: products.slice(0, 3),
      userProfile,
      conversationContext
    };
    
    onActionClick?.(action, context);
  };

  if (Object.keys(groupedActions).length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {getRelevantActions().slice(0, 6).map((action) => (
        <Button
          key={action.id}
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs hover:bg-primary/5 hover:border-primary/20 transition-all duration-200"
          onClick={() => handleActionClick(action)}
        >
          <div className="flex items-center space-x-1">
            {action.icon}
            <span>{action.label}</span>
          </div>
        </Button>
      ))}
    </div>
  );
}