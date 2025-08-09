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
    // Shopping Actions
    {
      id: 'add_to_cart',
      label: 'Add to Cart',
      icon: <ShoppingCart className="w-4 h-4" />,
      category: 'shopping',
      priority: 9,
      requiresProducts: true
    },
    {
      id: 'quick_buy',
      label: 'Quick Buy',
      icon: <Zap className="w-4 h-4" />,
      category: 'shopping',
      priority: 8,
      requiresProducts: true
    },
    {
      id: 'save_for_later',
      label: 'Save for Later',
      icon: <Heart className="w-4 h-4" />,
      category: 'shopping',
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
    {
      id: 'check_deals',
      label: 'Check Deals',
      icon: <Tag className="w-4 h-4" />,
      category: 'shopping',
      priority: 8,
      context: ['price_sensitive', 'budget_conscious']
    },

    // Discovery Actions
    {
      id: 'smart_filter',
      label: 'Smart Filter',
      icon: <Filter className="w-4 h-4" />,
      category: 'discovery',
      priority: 7,
      context: ['browsing', 'exploring']
    },
    {
      id: 'similar_products',
      label: 'Find Similar',
      icon: <Search className="w-4 h-4" />,
      category: 'discovery',
      priority: 6,
      requiresProducts: true
    },
    {
      id: 'personalized_recommendations',
      label: 'Just for You',
      icon: <Sparkles className="w-4 h-4" />,
      category: 'discovery',
      priority: 8,
      context: ['returning_user', 'high_engagement']
    },
    {
      id: 'trending_now',
      label: 'Trending Now',
      icon: <Zap className="w-4 h-4" />,
      category: 'discovery',
      priority: 5
    },

    // Service Actions
    {
      id: 'gift_options',
      label: 'Gift Options',
      icon: <Gift className="w-4 h-4" />,
      category: 'service',
      priority: 7,
      context: ['gift_intent', 'special_occasion'],
      requiresProducts: true
    },
    {
      id: 'delivery_info',
      label: 'Delivery Info',
      icon: <Truck className="w-4 h-4" />,
      category: 'service',
      priority: 6,
      context: ['urgency', 'shipping_inquiry']
    },
    {
      id: 'size_guide',
      label: 'Size Guide',
      icon: <Clock className="w-4 h-4" />,
      category: 'service',
      priority: 5,
      context: ['clothing', 'jewelry', 'watches'],
      requiresProducts: true
    },

    // Social Actions
    {
      id: 'share_product',
      label: 'Share',
      icon: <Share2 className="w-4 h-4" />,
      category: 'social',
      priority: 4,
      requiresProducts: true
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
    <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Quick Actions
          </h3>
          <Badge variant="secondary" className="text-xs">
            {Object.values(groupedActions).flat().length} available
          </Badge>
        </div>

        <div className="space-y-3">
          {Object.entries(groupedActions).map(([category, actions]) => (
            <div key={category}>
              <div className="flex items-center space-x-2 mb-2">
                {getCategoryIcon(category)}
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 capitalize">
                  {category}
                </span>
                <Badge className={`text-xs ${getCategoryColor(category)}`}>
                  {actions.length}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {actions.map((action) => (
                  <Button
                    key={action.id}
                    variant="outline"
                    size="sm"
                    className="h-auto p-2 flex flex-col items-center space-y-1 hover:bg-white hover:shadow-sm dark:hover:bg-gray-800 transition-all duration-200"
                    onClick={() => handleActionClick(action)}
                  >
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                      {action.icon}
                    </div>
                    <span className="text-xs text-center leading-tight">
                      {action.label}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Special promotions based on user profile */}
        {userProfile?.emotionalProfile?.enthusiasmLevel > 0.8 && (
          <div className="mt-4 p-3 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30 rounded-lg border border-yellow-200 dark:border-yellow-700">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                You're clearly excited! Get 15% off your first purchase today.
              </span>
            </div>
            <Button 
              size="sm" 
              className="mt-2 bg-yellow-600 hover:bg-yellow-700"
              onClick={() => handleActionClick({
                id: 'claim_discount',
                label: 'Claim Discount',
                icon: <Tag className="w-4 h-4" />,
                category: 'shopping',
                priority: 10
              })}
            >
              Claim 15% Off
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}