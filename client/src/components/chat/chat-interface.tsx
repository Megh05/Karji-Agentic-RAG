import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Paperclip, Bot, User } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ChatMessage, ChatResponse } from "@/lib/types";
import Message from "./message";
import ContextualFollowUps from "./contextual-follow-ups";
import QuickActions from "./quick-actions";
import { useToast } from "@/hooks/use-toast";
import { SettingsButton } from "@/components/settings";

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: '👋 Welcome to KarjiStore! We specialize in premium fragrances from top designers like Roberto Cavalli and Tom Ford. I\'m here to help you find the perfect scent - whether you\'re shopping for yourself or looking for a gift. What brings you here today?',
      timestamp: new Date(),
      followUpQuestions: [
        "Browse women's fragrances",
        "Show me men's cologne",
        "I need gift recommendations",
        "What's popular right now?"
      ]
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const chatMutation = useMutation({
    mutationFn: async (message: string): Promise<ChatResponse> => {
      const response = await apiRequest("POST", "/api/chat", { 
        message, 
        sessionId: sessionId || undefined 
      });
      return response.json();
    },
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: (data) => {
      setIsTyping(false);
      
      // Update session ID if received from server
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        console.log('Session established:', data.sessionId);
      }
      
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: data.message,
        products: data.products,
        timestamp: new Date(),
        uiElements: data.uiElements,
        followUpQuestions: data.followUpQuestions,
        actions: data.actions
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
    onError: (error) => {
      setIsTyping(false);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
        className: "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
      });
    }
  });

  const handleSend = () => {
    const message = input.trim();
    if (!message) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    chatMutation.mutate(message);
  };

  const sendDirectMessage = (message: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    chatMutation.mutate(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full chat-container">
      {/* Chat Header - Compact */}
      <div className="bg-card border-b border-border backdrop-blur-sm px-4 py-3 lg:px-6 lg:py-4 bg-gradient-to-r from-card/90 to-muted/20 sticky top-0 z-20">
        <div className="flex items-center max-w-6xl mx-auto">
          <div className="flex items-center space-x-3">
            <div className="bot-avatar w-10 h-10 lg:w-12 lg:h-12">
              <Bot className="w-4 h-4 lg:w-5 lg:h-5" />
            </div>
            <div>
              <h1 className="text-sm lg:text-base font-heading font-semibold text-foreground">KarjiStore Concierge</h1>
              <p className="text-xs text-muted-foreground">Premium Fragrances & Luxury Accessories</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Container - Luxury Design - Flexible */}
      <div className="flex-1 overflow-y-auto message-area relative z-10">
        <div className="min-h-full">
          {messages.map((message) => (
            <Message 
              key={message.id} 
              message={message} 
              onFollowUpClick={sendDirectMessage}
            />
          ))}
          
          {/* Typing Indicator - Luxury Design */}
          {isTyping && (
            <div className="flex items-start space-x-4 lg:space-x-6">
              <div className="bot-avatar">
                <Bot className="w-5 h-5 lg:w-6 lg:h-6" />
              </div>
              <div className="typing-indicator">
                <div className="typing-dots">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            </div>
          )}

          {/* Contextual Follow-ups - HIDDEN FOR NOW */}
          {sessionId && (
            <div className="mb-4 hidden">
              <ContextualFollowUps
                sessionId={sessionId}
                conversationLength={messages.length}
                userProfile={userProfile}
                onFollowUpClick={(followUp) => {
                  sendDirectMessage(followUp.message);
                }}
                onActionClick={(action) => {
                  console.log('Follow-up action received:', action);
                  sendDirectMessage(action);
                }}
              />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input - Luxury Design - Sticky Bottom */}
      <div className="bg-card border-t border-border backdrop-blur-sm px-4 py-3 lg:px-6 lg:py-4 flex-shrink-0 sticky bottom-0 z-20">
        <div className="max-w-6xl mx-auto">
          {/* Quick Actions - HIDDEN FOR NOW */}
          {messages.length > 1 && (
            <div className="mb-4 hidden">
              <QuickActions
                products={messages.slice(-1)[0]?.products}
                userProfile={userProfile}
                conversationContext={input}
                onActionClick={(action, context) => {
                  sendDirectMessage(action.label);
                }}
              />
            </div>
          )}

          <div className="flex items-end space-x-2 lg:space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about luxury fragrances, get personalized recommendations, or explore our premium collection..."
                  className="luxury-input pr-12 lg:pr-16 min-h-[44px] lg:min-h-[48px] text-sm lg:text-sm resize-none py-2 lg:py-3"
                  disabled={chatMutation.isPending}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 lg:right-3 top-1/2 transform -translate-y-1/2 rounded-xl w-8 h-8 lg:w-10 lg:h-10"
                  title="Attach file"
                >
                  <Paperclip className="w-4 h-4 lg:w-5 lg:h-5" />
                </Button>
              </div>
            </div>
            
            <Button 
              onClick={handleSend}
              disabled={!input.trim() || chatMutation.isPending}
              className="luxury-btn min-h-[44px] lg:min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed px-4 lg:px-6"
              size="default"
            >
              {chatMutation.isPending ? (
                <div className="w-4 h-4 lg:w-5 lg:h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline text-sm">Send</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
