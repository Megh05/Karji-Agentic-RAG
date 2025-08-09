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

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: '👋 Welcome to KarjiStore! I\'m your AI sales assistant. I can help you find products, answer questions about our inventory, and recommend the best deals. How can I assist you today?',
      timestamp: new Date()
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center">
              <Bot className="text-white w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">AI Sales Assistant</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Ready to help you find the perfect products</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button size="sm" variant="outline" className="bg-secondary text-white border-secondary hover:bg-secondary/90">
              <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
              Online
            </Button>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}
        
        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="text-white w-4 h-4" />
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Contextual Follow-ups */}
        {sessionId && (
          <div className="mb-4">
            <ContextualFollowUps
              sessionId={sessionId}
              conversationLength={messages.length}
              userProfile={userProfile}
              onFollowUpClick={(followUp) => {
                setInput(followUp.message);
                setTimeout(() => handleSend(), 100);
              }}
              onActionClick={(action) => {
                console.log('Follow-up action received:', action);
                setInput(action);
                setTimeout(() => handleSend(), 100);
              }}
            />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        {/* Quick Actions */}
        {messages.length > 1 && (
          <div className="mb-3">
            <QuickActions
              products={messages.slice(-1)[0]?.products}
              userProfile={userProfile}
              conversationContext={input}
              onActionClick={(action, context) => {
                setInput(action.label);
                setTimeout(() => handleSend(), 100);
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
