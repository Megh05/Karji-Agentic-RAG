import { Bot, User } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import ProductCard from "./product-card";
import { ProductCarousel } from "../ui/product-carousel";
import { Button } from "@/components/ui/button";
import WelcomeGuide from "./welcome-guide";
import ProductComparison from "./product-comparison";
import type { Product } from "@shared/schema";

interface FormattedLine {
  content: string;
  type: 'header' | 'subheader' | 'paragraph' | 'bullet' | 'subbullet' | 'spacing';
  level?: number;
}

function formatMessageContent(content: string): FormattedLine[] {
  let formatted = content;
  
  // Clean up markdown formatting
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '$1');
  
  // Split into logical sections
  const lines = formatted.split(/\n+/).map(line => line.trim()).filter(line => line.length > 0);
  
  const result: FormattedLine[] = [];
  let lastWasHeader = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];
    
    // Detect main headers (short lines that introduce sections, often followed by content)
    if (line.length < 60 && 
        (line.endsWith(':') || 
         (line.match(/^[A-Z][a-z\s]+$/) && nextLine && (nextLine.startsWith('-') || nextLine.toLowerCase().includes('you can') || nextLine.toLowerCase().includes('we'))))) {
      if (result.length > 0 && !lastWasHeader) {
        result.push({ content: '', type: 'spacing' });
      }
      result.push({ content: line.replace(':', ''), type: 'header' });
      lastWasHeader = true;
      continue;
    }
    
    // Detect sub-headers (caps words that are section titles)
    if (line.length < 40 && line.match(/^[A-Z][a-z\s]+$/) && !line.includes('.') && !line.startsWith('-')) {
      if (!lastWasHeader) {
        result.push({ content: '', type: 'spacing' });
      }
      result.push({ content: line, type: 'subheader' });
      lastWasHeader = true;
      continue;
    }
    
    // Handle bullet points and lists
    if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('·')) {
      const cleanedContent = line.replace(/^[-•·]\s*/, '');
      
      // Determine if this is a sub-bullet (shorter, continuation of previous concept)
      const isSubBullet = cleanedContent.length < 80 && 
                          result.length > 0 && 
                          (result[result.length - 1].type === 'bullet' || result[result.length - 1].type === 'subbullet');
      
      result.push({ 
        content: cleanedContent, 
        type: isSubBullet ? 'subbullet' : 'bullet'
      });
      lastWasHeader = false;
      continue;
    }
    
    // Handle regular paragraphs
    if (line.length > 0) {
      // If it looks like a continuation of a bullet point concept, make it a sub-bullet
      if (result.length > 0 && result[result.length - 1].type === 'bullet' && line.length < 120) {
        result.push({ content: line, type: 'subbullet' });
      } else {
        result.push({ content: line, type: 'paragraph' });
      }
      lastWasHeader = false;
    }
  }
  
  return result;
}

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
    <div className={`mb-8 ${isUser ? 'flex justify-end' : 'flex justify-start'}`}>
      <div className={`flex items-start space-x-4 max-w-4xl ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900 flex items-center justify-center flex-shrink-0 shadow-lg">
            <Bot className="w-4 h-4" />
          </div>
        )}
        
        {isUser && (
          <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0 shadow-lg">
            <User className="w-4 h-4" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className={`message-bubble ${isUser ? 'user' : 'ai'}`}>
            <div className="leading-relaxed text-sm">
              {formatMessageContent(message.content).map((item, index) => {
                switch (item.type) {
                  case 'header':
                    return (
                      <h3 key={index} className="text-lg font-bold text-foreground mt-6 mb-3 first:mt-2">
                        {item.content}
                      </h3>
                    );
                  
                  case 'subheader':
                    return (
                      <h4 key={index} className="text-base font-semibold text-foreground mt-4 mb-2">
                        {item.content}
                      </h4>
                    );
                  
                  case 'paragraph':
                    return (
                      <p key={index} className="leading-6 mb-3 text-foreground">
                        {item.content}
                      </p>
                    );
                  
                  case 'bullet':
                    return (
                      <div key={index} className="flex items-start mb-2">
                        <span className="text-primary mr-2 mt-1 flex-shrink-0">•</span>
                        <span className="leading-6 text-foreground">{item.content}</span>
                      </div>
                    );
                  
                  case 'subbullet':
                    return (
                      <div key={index} className="flex items-start ml-6 mb-2">
                        <span className="text-muted-foreground mr-2 mt-1 flex-shrink-0">◦</span>
                        <span className="leading-6 text-muted-foreground">{item.content}</span>
                      </div>
                    );
                  
                  case 'spacing':
                    return <div key={index} className="h-2" />;
                  
                  default:
                    return (
                      <p key={index} className="leading-6 mb-2">
                        {item.content}
                      </p>
                    );
                }
              })}
            </div>
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
      </div>
    </div>
  );
}
