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
        variant: "destructive"
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
    <>
      {/* Chat Header - 3D Cardboard Design */}
      <div className="nav-3d px-6 py-6 cardboard-responsive-padding relative overflow-hidden">
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="cardboard-medium gold-button w-16 h-16 lg:w-20 lg:h-20 rounded-2xl flex items-center justify-center cardboard-float">
              <Bot className="text-primary-foreground w-7 h-7 lg:w-9 lg:h-9 icon-3d" />
            </div>
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold luxury-text cardboard-responsive-text">KarjiStore Concierge</h2>
              <p className="text-sm lg:text-base text-muted-foreground cardboard-text">Premium Fragrances & Luxury Accessories</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <SettingsButton sessionId={sessionId} />
            <div className="gold-button px-4 py-3 lg:px-6 lg:py-4 rounded-2xl">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse cardboard-pulse"></div>
                <span className="text-sm lg:text-base font-semibold">Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Container - 3D Cardboard Design */}
      <div className="flex-1 overflow-y-auto cardboard-responsive-padding space-y-6 bg-background"
           style={{ backgroundImage: 'var(--cardboard-texture)', backgroundSize: '24px 24px' }}>
        {messages.map((message) => (
          <Message 
            key={message.id} 
            message={message} 
            onFollowUpClick={sendDirectMessage}
          />
        ))}
        
        {/* Typing Indicator - 3D Cardboard Design */}
        {isTyping && (
          <div className="flex items-start space-x-4">
            <div className="cardboard-medium gold-button w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Bot className="text-primary-foreground w-6 h-6 icon-3d" />
            </div>
            <div className="cardboard-light rounded-3xl rounded-tl-lg p-6">
              <div className="flex space-x-3">
                <div className="w-4 h-4 bg-primary rounded-full animate-bounce"></div>
                <div className="w-4 h-4 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-4 h-4 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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
                // Send the message directly as a request
                sendDirectMessage(followUp.message);
              }}
              onActionClick={(action) => {
                console.log('Follow-up action received:', action);
                // Send the action directly as a request
                sendDirectMessage(action);
              }}
            />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input - 3D Cardboard Design */}
      <div className="cardboard-light border-t-4 border-border cardboard-responsive-padding bg-card">
        <div className="max-w-4xl mx-auto">
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

          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about luxury fragrances, get personalized recommendations, or explore our premium collection..."
                  className="input-cardboard pr-16 min-h-[56px] rounded-2xl text-base cardboard-responsive-text focus-cardboard"
                  disabled={chatMutation.isPending}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 cardboard-medium rounded-xl w-10 h-10 icon-3d"
                  title="Attach file"
                >
                  <Paperclip className="w-5 h-5" />
                </Button>
              </div>
            </div>
            
            <Button 
              onClick={handleSend}
              disabled={!input.trim() || chatMutation.isPending}
              className="btn-gold rounded-2xl px-8 py-4 text-base font-bold icon-3d disabled:opacity-50 disabled:cursor-not-allowed min-h-[56px]"
              size="default"
            >
              {chatMutation.isPending ? (
                <div className="w-6 h-6 border-3 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="h-5 w-5 sm:mr-2" />
                  <span className="hidden sm:inline">Send</span>
                </>
              )}
            </Button>
          </div>
          
          <div className="mt-4 flex items-center justify-between text-sm cardboard-text cardboard-responsive-text opacity-70">
            <span>Press Enter to send • Shift+Enter for new line</span>
            <span className="luxury-text font-semibold">Powered by KarjiStore AI</span>
          </div>
        </div>
      </div>
    </>
  );
}
