import { Bot, User } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import ProductCard from "./product-card";
import SmartProductCarousel from "./smart-product-carousel";
import { Button } from "@/components/ui/button";

interface MessageProps {
  message: ChatMessage;
}

export default function Message({ message }: MessageProps) {
  const isUser = message.type === 'user';

  return (
    <div className={`flex items-start space-x-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0">
          <Bot className="text-white w-4 h-4" />
        </div>
      )}
      
      <div className={`max-w-2xl ${isUser ? 'order-first' : ''}`}>
        <div className={`rounded-lg p-4 shadow-sm ${
          isUser 
            ? 'bg-primary text-white' 
            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
        }`}>
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        
        {/* Smart Products Display */}
        {message.products && message.products.length > 0 && (
          <div className="mt-3">
            {message.uiElements?.showCarousel ? (
              <SmartProductCarousel 
                products={message.products} 
                uiElements={message.uiElements}
                onProductAction={(action, productId, extra) => {
                  console.log('Product action:', action, productId, extra);
                }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {message.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Follow-up Questions */}
        {message.followUpQuestions && message.followUpQuestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.followUpQuestions.map((question, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="text-sm border-primary/20 hover:border-primary hover:bg-primary/5"
                onClick={() => {
                  console.log('Follow-up question clicked:', question);
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
