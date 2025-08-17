import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, Send, MessageCircle, X, Gift, Watch, Sparkles, Heart } from 'lucide-react';

// Types
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface QuickAction {
  label: string;
  value: string;
  icon: React.ComponentType<any>;
}

// Component Props
interface KarjistoreChatBotProps {
  /** Callback when a message is sent */
  onSendMessage?: (message: string) => Promise<string>;
  /** Custom quick actions */
  quickActions?: QuickAction[];
  /** Custom welcome message */
  welcomeMessage?: string;
  /** Custom placeholder text */
  placeholder?: string;
  /** Custom title */
  title?: string;
  /** Custom subtitle */
  subtitle?: string;
}

// Default quick actions
const defaultQuickActions: QuickAction[] = [
  { label: "Gift Sets", value: "Show me your gift sets", icon: Gift },
  { label: "Watches", value: "Show me your timepiece collection", icon: Watch },
  { label: "Perfumes", value: "What perfumes and fragrances do you have?", icon: Sparkles },
  { label: "Bath & Body", value: "Show me your bath and body products", icon: Heart },
];

// Default bot responses
const defaultBotResponses: { [key: string]: string } = {
  "Show me your gift sets": "Our luxury gift sets are perfect for special occasions. We offer curated collections featuring our finest fragrances, premium accessories, and elegant packaging that reflects the sophistication of the Karjistore brand.",
  "Show me your timepiece collection": "Discover our exquisite timepiece collection featuring Swiss craftsmanship and elegant designs. Each watch in our collection represents the perfect fusion of traditional horological expertise and contemporary luxury aesthetics.",
  "What perfumes and fragrances do you have?": "Our fragrance collection includes rare and exclusive scents from the world's most prestigious perfume houses. From fresh citrus notes to deep, mysterious compositions, each fragrance tells a unique story of luxury and elegance.",
  "Show me your bath and body products": "Indulge in our luxurious bath and body collection featuring premium ingredients and sophisticated scents. Our range includes moisturizing lotions, exfoliating scrubs, and aromatic bath oils for the ultimate spa experience at home."
};

const KarjistoreChatBot: React.FC<KarjistoreChatBotProps> = ({
  onSendMessage,
  quickActions = defaultQuickActions,
  welcomeMessage = "Welcome to your personal luxury shopping experience at Karjistore. I'm your dedicated concierge, ready to help you discover our finest collections of fragrances, timepieces, and accessories.",
  placeholder = "Share your luxury preferences...",
  title = "Luxury Concierge",
  subtitle = "Personal Assistant Available"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Generate unique ID for messages
  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Handle sending messages
  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage: Message = {
      id: generateId(),
      content: message.trim(),
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsTyping(true);

    try {
      // Use custom handler or default responses
      const response = onSendMessage 
        ? await onSendMessage(userMessage.content)
        : defaultBotResponses[userMessage.content] || "Thank you for your message. Our luxury concierge is here to assist you with any questions about our premium collections.";

      // Simulate typing delay
      setTimeout(() => {
        const botMessage: Message = {
          id: generateId(),
          content: response,
          role: 'assistant',
          timestamp: new Date()
        };

        setMessages(prev => [...prev, botMessage]);
        setIsTyping(false);
      }, 1500);
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickAction = (actionValue: string) => {
    setMessage(actionValue);
    setTimeout(() => handleSendMessage(), 100);
  };

  return (
    <>
      {/* Floating Chat Button - HIDDEN FOR NOW */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="hidden fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-karjistore-teal via-karjistore-slate to-karjistore-charcoal text-white rounded-full shadow-lg z-50 flex items-center justify-center"
          aria-label="Open chat"
          data-testid="button-open-chat"
        >
          <MessageCircle className="h-7 w-7" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="karjistore-chat fixed bottom-6 right-6 w-96 h-[600px] bg-white dark:bg-card rounded-3xl shadow-2xl border border-gray-200 dark:border-border flex flex-col z-50 overflow-hidden">
          {/* Header */}
          <div className="bg-white dark:bg-card p-5 rounded-t-3xl relative overflow-hidden border-b border-gray-100/80 dark:border-border">
            <div className="absolute inset-0 bg-gradient-to-r from-karjistore-gainsboro/30 via-karjistore-silver/20 to-karjistore-gainsboro/10 dark:from-karjistore-charcoal/10 dark:via-karjistore-slate/5 dark:to-karjistore-charcoal/10"></div>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-karjistore-teal via-karjistore-slate to-karjistore-charcoal dark:from-karjistore-teal dark:via-karjistore-slate dark:to-karjistore-charcoal rounded-full flex items-center justify-center shadow-lg">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-foreground" data-testid="text-chat-title">{title}</h3>
                  <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-muted-foreground">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg"></div>
                    <span data-testid="text-chat-subtitle">{subtitle}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 dark:text-muted-foreground h-auto p-2 rounded-full"
                aria-label="Close chat"
                data-testid="button-close-chat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-5 h-80 overflow-y-auto bg-white dark:bg-card">
            {/* Welcome Message */}
            {messages.length === 0 && (
              <div className="mb-6">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-karjistore-teal via-karjistore-slate to-karjistore-charcoal dark:from-karjistore-teal dark:via-karjistore-slate dark:to-karjistore-charcoal rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div className="bg-gray-50 dark:bg-muted rounded-2xl rounded-tl-sm p-4 shadow-sm border border-gray-100 dark:border-border max-w-72">
                    <p className="text-gray-800 dark:text-foreground text-sm leading-relaxed" data-testid="text-welcome-message">
                      {welcomeMessage}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Message List */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-6 ${msg.role === "user" ? "flex justify-end" : ""}`}
                data-testid={`message-${msg.role}-${msg.id}`}
              >
                {msg.role === "user" ? (
                  <div className="flex items-start space-x-3 justify-end">
                    <div className="bg-karjistore-gainsboro/20 dark:bg-karjistore-charcoal/20 text-gray-800 dark:text-foreground rounded-2xl rounded-tr-sm p-4 shadow-sm max-w-72 border border-karjistore-silver/30 dark:border-karjistore-slate/20">
                      <p className="text-sm leading-relaxed" data-testid={`text-user-message-${msg.id}`}>{msg.content}</p>
                    </div>
                    <div className="w-10 h-10 bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 dark:from-gray-600 dark:via-gray-700 dark:to-gray-800 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                      <User className="h-5 w-5 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-karjistore-teal via-karjistore-slate to-karjistore-charcoal dark:from-karjistore-teal dark:via-karjistore-slate dark:to-karjistore-charcoal rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div className="bg-gray-50 dark:bg-muted rounded-2xl rounded-tl-sm p-4 shadow-sm border border-gray-100 dark:border-border max-w-72">
                      <p className="text-gray-800 dark:text-foreground text-sm leading-relaxed" data-testid={`text-bot-message-${msg.id}`}>{msg.content}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="mb-6" data-testid="typing-indicator">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-karjistore-teal via-karjistore-slate to-karjistore-charcoal dark:from-karjistore-teal dark:via-karjistore-slate dark:to-karjistore-charcoal rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div className="bg-gray-50 dark:bg-muted rounded-2xl rounded-tl-sm p-4 shadow-sm border border-gray-100 dark:border-border">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 bg-karjistore-teal dark:bg-karjistore-teal rounded-full animate-bounce"></div>
                      <div className="w-3 h-3 bg-karjistore-teal dark:bg-karjistore-teal rounded-full animate-bounce delay-100"></div>
                      <div className="w-3 h-3 bg-karjistore-teal dark:bg-karjistore-teal rounded-full animate-bounce delay-200"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-5 bg-white dark:bg-card rounded-b-3xl border-t border-gray-100 dark:border-border">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder={placeholder}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full bg-gray-50 dark:bg-input border border-gray-200 dark:border-border rounded-2xl px-6 py-4 text-sm text-gray-800 dark:text-foreground focus:ring-2 focus:ring-karjistore-teal dark:focus:ring-karjistore-teal focus:border-karjistore-teal dark:focus:border-karjistore-teal shadow-sm outline-none"
                  data-testid="input-message"
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!message.trim()}
                className="bg-gradient-to-br from-karjistore-teal via-karjistore-slate to-karjistore-charcoal disabled:from-gray-300 disabled:via-gray-300 disabled:to-gray-300 dark:disabled:from-gray-600 dark:disabled:via-gray-600 dark:disabled:to-gray-600 text-white w-12 h-12 rounded-2xl p-0 shadow-md disabled:cursor-not-allowed flex items-center justify-center"
                data-testid="button-send-message"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => {
                const IconComponent = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action.value)}
                    className="bg-gray-50 dark:bg-accent text-gray-800 dark:text-foreground text-xs py-3 px-4 rounded-xl border border-gray-200 dark:border-border font-medium flex items-center gap-2"
                    data-testid={`button-quick-action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <IconComponent className="h-4 w-4 text-karjistore-teal dark:text-karjistore-teal" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KarjistoreChatBot;