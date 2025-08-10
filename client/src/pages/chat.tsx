import KarjistoreChatBot from "@/components/chat/karjistore-chatbot";

// Example luxury hero section
function LuxuryHeroSection() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50/30 to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.1)_0%,transparent_50%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.05)_0%,transparent_50%)]"></div>
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="max-w-4xl mx-auto">
          {/* Logo/Brand */}
          <div className="mb-8">
            <h1 className="text-6xl md:text-7xl font-serif font-bold bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 dark:from-amber-400 dark:via-yellow-400 dark:to-amber-500 bg-clip-text text-transparent mb-4" data-testid="text-brand-name">
              KarjiStore
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 font-light tracking-wide" data-testid="text-brand-tagline">
              Luxury Fragrances & Timepieces
            </p>
          </div>

          {/* Description */}
          <div className="mb-12">
            <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed max-w-2xl mx-auto mb-6" data-testid="text-brand-description">
              Welcome to your personal luxury shopping experience. We specialize in premium fragrances from top designers like Roberto Cavalli, exclusive timepieces, and curated luxury collections.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                Premium Fragrances
              </span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                Luxury Timepieces
              </span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                Expert Curation
              </span>
            </div>
          </div>

          {/* CTA */}
          <div className="mb-8">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Start a conversation with our AI luxury concierge
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Personal Assistant Available</span>
            </div>
          </div>
        </div>

        {/* Floating elements for visual appeal */}
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-gradient-to-br from-amber-200/20 to-yellow-200/10 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-gradient-to-br from-yellow-200/20 to-amber-200/10 rounded-full blur-xl animate-pulse delay-1000"></div>
      </div>
    </div>
  );
}

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
    <>
      <LuxuryHeroSection />
      <KarjistoreChatBot 
        onSendMessage={handleSendMessage}
        welcomeMessage="Welcome to KarjiStore! I'm your personal luxury shopping assistant. I can help you discover premium fragrances, exclusive timepieces, and curated luxury collections. What are you looking for today?"
        title="Luxury Concierge"
        subtitle="Personal Assistant Available"
        placeholder="Tell me about your luxury preferences..."
      />
    </>
  );
}
