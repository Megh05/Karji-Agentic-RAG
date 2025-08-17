import { Bot, User } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import ProductCard from "./product-card";
import { ProductCarousel } from "../ui/product-carousel";
import { Button } from "@/components/ui/button";
import WelcomeGuide from "./welcome-guide";
import ProductComparison from "./product-comparison";
import type { Product } from "@shared/schema";

// Helper function to determine if products should be shown in carousel
function shouldShowCarousel(products: any[]): boolean {
  if (products.length < 3) return false;
  
  // Check if at least 3 products share the same category
  const categories = products.map(p => p.category?.toLowerCase()).filter(Boolean);
  const categoryCount = categories.reduce((acc, cat) => {
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.values(categoryCount).some(count => (count as number) >= 3);
}

// Helper function to get carousel title based on common category
function getCarouselTitle(products: any[]): string {
  const categories = products.map(p => p.category).filter(Boolean);
  const categoryCount = categories.reduce((acc, cat) => {
    acc[cat!] = (acc[cat!] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const mostCommonCategory = Object.entries(categoryCount)
    .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0];
  
  return mostCommonCategory ? `${mostCommonCategory} Collection` : 'Product Collection';
}

interface MessageProps {
  message: ChatMessage;
  onFollowUpClick?: (message: string) => void;
}

export default function Message({ message, onFollowUpClick }: MessageProps) {
  const isUser = message.type === 'user';

  return (
    <div className={`flex items-start space-x-4 mb-6 ${isUser ? 'justify-end' : ''} relative z-30`}>
      {!isUser && (
        <div className="bot-avatar relative z-30">
          <Bot className="w-6 h-6" />
        </div>
      )}
      
      <div className={`max-w-4xl lg:max-w-5xl ${isUser ? 'order-first' : ''} relative z-30`}>
        <div className={`${
          isUser 
            ? 'user-bubble rounded-tr-lg' 
            : 'bot-bubble rounded-tl-lg'
        } relative z-30`}>
          <p className="whitespace-pre-wrap leading-relaxed text-sm lg:text-sm relative z-30">{message.content}</p>
        </div>
        
        {/* Welcome Guide for first message */}
        {!isUser && message.id === '1' && (
          <div className="mt-3">
            <WelcomeGuide 
              onCategorySelect={(category) => onFollowUpClick?.(category)}
              onQuestionSelect={(question) => onFollowUpClick?.(question)}
            />
          </div>
        )}

        {/* Smart Products Display */}
        {message.products && message.products.length > 0 && (
          <div className="mt-3">
            {/* Show comparison view if message content suggests comparison */}
            {message.content.toLowerCase().includes('compar') && message.products.length >= 2 ? (
              <ProductComparison 
                products={message.products} 
                onSelectProduct={(productId) => onFollowUpClick?.(`Tell me more about ${message.products?.find(p => p.id === productId)?.title}`)}
                onAddToWishlist={(productId) => onFollowUpClick?.(`Add ${message.products?.find(p => p.id === productId)?.title} to my wishlist`)}
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-full">
                {message.products.slice(0, 6).map((product: any, index: number) => (
                  <ProductCard key={product.id || index} product={product} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Follow-up Questions - HIDDEN FOR NOW */}
        {message.followUpQuestions && message.followUpQuestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 hidden">
            {message.followUpQuestions.map((question, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="text-sm border-primary/20 hover:border-primary hover:bg-primary/5"
                onClick={() => {
                  console.log('Follow-up question clicked:', question);
                  onFollowUpClick?.(question);
                }}
              >
                {question}
              </Button>
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="text-gray-600 dark:text-gray-300 w-4 h-4" />
        </div>
      )}
    </div>
  );
}
