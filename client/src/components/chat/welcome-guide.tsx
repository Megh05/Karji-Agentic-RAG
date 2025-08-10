import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Heart, 
  Gift, 
  Star, 
  Truck, 
  Shield,
  Clock,
  MapPin
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  popular: boolean;
  examples: string[];
}

interface WelcomeGuideProps {
  onCategorySelect?: (category: string) => void;
  onQuestionSelect?: (question: string) => void;
}

export default function WelcomeGuide({ 
  onCategorySelect, 
  onQuestionSelect 
}: WelcomeGuideProps) {
  const [activeTab, setActiveTab] = useState<'categories' | 'help' | 'store'>('categories');

  const categories: Category[] = [
    {
      id: 'womens_perfumes',
      name: "Women's Fragrances",
      description: "Elegant and sophisticated scents for every occasion",
      icon: <Sparkles className="w-5 h-5" />,
      popular: true,
      examples: ["Floral", "Oriental", "Fresh", "Woody"]
    },
    {
      id: 'mens_cologne',
      name: "Men's Cologne", 
      description: "Bold and distinctive fragrances for the modern man",
      icon: <Shield className="w-5 h-5" />,
      popular: true,
      examples: ["Woody", "Aquatic", "Spicy", "Citrus"]
    },
    {
      id: 'gift_sets',
      name: "Gift Sets",
      description: "Perfect presents for birthdays, anniversaries, and special occasions",
      icon: <Gift className="w-5 h-5" />,
      popular: false,
      examples: ["For Him", "For Her", "Couples", "Travel Size"]
    },
    {
      id: 'luxury_niche',
      name: "Luxury & Niche",
      description: "Exclusive and rare fragrances from premium brands",
      icon: <Star className="w-5 h-5" />,
      popular: false,
      examples: ["Tom Ford", "Roberto Cavalli", "Limited Edition"]
    }
  ];

  const quickQuestions = [
    "What's your bestselling perfume?",
    "Do you have any current offers?",
    "I'm looking for something under 200 AED",
    "What's good for everyday wear?",
    "I need something for a special occasion",
    "Can you recommend something fresh and light?"
  ];

  const storeHighlights = [
    {
      icon: <Truck className="w-5 h-5 text-green-600" />,
      title: "Fast UAE Shipping",
      description: "Same-day delivery in Dubai, 1-2 days nationwide"
    },
    {
      icon: <Shield className="w-5 h-5 text-blue-600" />,
      title: "100% Authentic",
      description: "Only genuine products from authorized distributors"
    },
    {
      icon: <Star className="w-5 h-5 text-yellow-600" />,
      title: "Premium Brands",
      description: "Roberto Cavalli, Tom Ford, and more luxury names"
    },
    {
      icon: <MapPin className="w-5 h-5 text-red-600" />,
      title: "UAE Based",
      description: "Local business serving the Emirates since 2020"
    }
  ];

  return (
    <div className="space-y-4" data-testid="welcome-guide">
      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'categories' 
              ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' 
              : 'text-gray-600 dark:text-gray-300 hover:text-primary'
          }`}
          data-testid="tab-categories"
        >
          Browse Categories
        </button>
        <button
          onClick={() => setActiveTab('help')}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'help' 
              ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' 
              : 'text-gray-600 dark:text-gray-300 hover:text-primary'
          }`}
          data-testid="tab-help"
        >
          Quick Questions
        </button>
        <button
          onClick={() => setActiveTab('store')}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'store' 
              ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' 
              : 'text-gray-600 dark:text-gray-300 hover:text-primary'
          }`}
          data-testid="tab-store"
        >
          Why Choose Us
        </button>
      </div>

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categories.map((category) => (
            <Card 
              key={category.id} 
              className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary/20"
              onClick={() => onCategorySelect?.(category.name)}
              data-testid={`category-${category.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="text-primary">{category.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-sm">{category.name}</h3>
                      {category.popular && (
                        <Badge variant="secondary" className="text-xs">
                          Popular
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                      {category.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {category.examples.map((example, idx) => (
                        <span 
                          key={idx}
                          className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded"
                        >
                          {example}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Questions Tab */}
      {activeTab === 'help' && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            Not sure where to start? Try one of these common questions:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {quickQuestions.map((question, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="justify-start h-auto p-3 text-left hover:bg-primary/5"
                onClick={() => onQuestionSelect?.(question)}
                data-testid={`quick-question-${idx}`}
              >
                <Clock className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-sm">{question}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Store Information Tab */}
      {activeTab === 'store' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {storeHighlights.map((highlight, idx) => (
            <div key={idx} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>{highlight.icon}</div>
              <div>
                <h3 className="font-semibold text-sm mb-1">{highlight.title}</h3>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {highlight.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}