import Sidebar from "@/components/layout/sidebar";
import ChatInterface from "@/components/chat/chat-interface";
import KarjistoreChatBot from "@/components/chat/karjistore-chatbot";

export default function ChatPage() {
  const handleSendMessage = async (message: string): Promise<string> => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      
      if (!response.ok) throw new Error('API Error');
      
      const data = await response.json();
      return data.reply || "Thank you for your message. I'm here to help you explore our luxury collections.";
    } catch (error) {
      console.error('Chat error:', error);
      return "I apologize, but I'm having trouble connecting right now. Please try again in a moment, and I'll be happy to assist you with our luxury collections.";
    }
  };

  return (
    <div className="flex h-screen max-h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full max-h-screen">
        <ChatInterface />
      </main>
      
      {/* Add the luxury floating chatbot as an additional feature */}
      <KarjistoreChatBot 
        onSendMessage={handleSendMessage}
        welcomeMessage="Welcome to KarjiStore! I'm your personal luxury shopping assistant. I can help you discover premium fragrances, exclusive timepieces, and curated luxury collections. What are you looking for today?"
        title="Luxury Concierge"
        subtitle="Personal Assistant Available"
        placeholder="Tell me about your luxury preferences..."
      />
    </div>
  );
}
