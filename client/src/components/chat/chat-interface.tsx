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
      {/* Luxury Chat Header */}
      <div className="luxury-glass border-b border-border/20 px-6 py-5 relative overflow-hidden">
        <div className="absolute inset-0 luxury-gradient-bg opacity-5"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent luxury-shimmer"></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="luxury-glow-animation w-14 h-14 luxury-gradient-bg rounded-2xl flex items-center justify-center shadow-2xl relative">
              <div className="absolute inset-0 luxury-gradient-bg rounded-2xl blur opacity-50"></div>
              <Bot className="text-white w-7 h-7 relative z-10" />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-luxury-display font-bold text-foreground luxury-text-glow">
                KarjiStore Concierge
              </h2>
              <p className="text-sm text-muted-foreground font-luxury-sans">
                Your personal luxury fragrance & timepiece advisor
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <SettingsButton sessionId={sessionId} />
            <div className="luxury-glass border border-border/30 px-5 py-3 rounded-2xl luxury-shadow relative group">
              <div className="absolute inset-0 luxury-gradient-bg rounded-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
              <div className="flex items-center space-x-3 relative">
                <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse shadow-lg"></div>
                <span className="text-sm font-luxury-sans font-medium text-foreground">Premium Service Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Luxury Messages Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-background relative">
        <div className="absolute inset-0 opacity-5">
          <div className="luxury-gradient-bg h-full w-full"></div>
        </div>
        {messages.map((message) => (
          <Message 
            key={message.id} 
            message={message} 
            onFollowUpClick={sendDirectMessage}
          />
        ))}
        
        {/* Luxury Typing Indicator */}
        {isTyping && (
          <div className="flex items-start space-x-4 relative z-10">
            <div className="luxury-glow-animation w-12 h-12 luxury-gradient-bg rounded-2xl flex items-center justify-center flex-shrink-0 luxury-shadow relative">
              <div className="absolute inset-0 luxury-gradient-bg rounded-2xl blur opacity-50"></div>
              <Bot className="text-white w-6 h-6 relative z-10" />
            </div>
            <div className="luxury-glass rounded-3xl rounded-tl-lg p-5 luxury-shadow border border-border/30 relative">
              <div className="absolute inset-0 luxury-gradient-bg rounded-3xl rounded-tl-lg opacity-5"></div>
              <div className="flex space-x-2 relative">
                <div className="w-3 h-3 bg-primary rounded-full animate-bounce shadow-lg"></div>
                <div className="w-3 h-3 bg-primary rounded-full animate-bounce shadow-lg" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-3 h-3 bg-primary rounded-full animate-bounce shadow-lg" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 font-luxury-sans">Concierge is thinking...</p>
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

      {/* Luxury Message Input */}
      <div className="luxury-glass border-t border-border/30 p-6 relative">
        <div className="absolute inset-0 luxury-gradient-bg opacity-3"></div>
        
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

        <div className="relative flex space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Share your luxury fragrance preferences..."
                className="input-luxury h-14 rounded-3xl px-6 pr-14 font-luxury-sans text-base placeholder:font-luxury-sans placeholder:text-muted-foreground/60 luxury-border-glow"
                disabled={chatMutation.isPending}
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-xl luxury-hover text-muted-foreground hover:text-foreground"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || chatMutation.isPending}
            className="btn-luxury-primary h-14 px-6 rounded-3xl font-luxury-sans font-medium"
          >
            <Send className="w-5 h-5 mr-2" />
            Send
          </Button>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground/80 font-luxury-sans">
          <span>Press Enter to send • Shift+Enter for new line</span>
          <span className="flex items-center space-x-2">
            <span>Powered by</span>
            <span className="text-primary font-medium">OpenRouter AI</span>
          </span>
        </div>
      </div>
    </>
  );
}
