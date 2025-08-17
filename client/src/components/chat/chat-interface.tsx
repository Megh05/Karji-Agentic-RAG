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
      {/* Chat Header */}
      <div className="bg-card dark:bg-card border-b border-border px-6 py-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-50/30 via-yellow-50/20 to-orange-50/10 dark:from-amber-900/10 dark:via-yellow-900/5 dark:to-amber-900/10"></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-600 via-yellow-600 to-amber-700 dark:from-amber-500 dark:via-yellow-500 dark:to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
              <Bot className="text-white w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Luxury AI Concierge</h2>
              <p className="text-sm text-muted-foreground">Ready to help you discover premium fragrances & timepieces</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <SettingsButton sessionId={sessionId} />
            <div className="bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 dark:from-amber-500 dark:via-yellow-500 dark:to-amber-600 text-white px-4 py-2 rounded-xl shadow-md">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-background dark:bg-background">
        {messages.map((message) => (
          <Message 
            key={message.id} 
            message={message} 
            onFollowUpClick={sendDirectMessage}
          />
        ))}
        
        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-600 via-yellow-600 to-amber-700 dark:from-amber-500 dark:via-yellow-500 dark:to-amber-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
              <Bot className="text-white w-5 h-5" />
            </div>
            <div className="bg-card dark:bg-card rounded-2xl rounded-tl-sm p-4 shadow-sm border border-border">
              <div className="flex space-x-2">
                <div className="w-3 h-3 bg-amber-600 dark:bg-amber-500 rounded-full animate-bounce"></div>
                <div className="w-3 h-3 bg-amber-600 dark:bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-3 h-3 bg-amber-600 dark:bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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

      {/* Message Input */}
      <div className="bg-card dark:bg-card border-t border-border p-4">
        {/* Quick Actions - HIDDEN FOR NOW */}
        {messages.length > 1 && (
          <div className="mb-3 hidden">
            <QuickActions
              products={messages.slice(-1)[0]?.products}
              userProfile={userProfile}
              conversationContext={input}
              onActionClick={(action, context) => {
                // Send the action directly as a request
                sendDirectMessage(action.label);
              }}
            />
          </div>
        )}

        <div className="flex space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about products, deals, or anything else..."
                className="pr-10"
                disabled={chatMutation.isPending}
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || chatMutation.isPending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <span>Powered by OpenRouter AI</span>
        </div>
      </div>
    </>
  );
}
