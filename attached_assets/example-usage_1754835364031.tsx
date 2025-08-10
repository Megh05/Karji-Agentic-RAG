import React from 'react';
import { Gift, Heart, Star, Crown, Sparkles, Watch } from 'lucide-react';
import KarjistoreChatBot from './KarjistoreChatBot';
// Import the CSS file for animations
import './KarjistoreChatBot.css';

// Example 1: Basic Usage
export function BasicChatExample() {
  return (
    <div className="min-h-screen bg-gray-100">
      <h1 className="text-3xl font-bold text-center py-8">My Luxury Store</h1>
      
      {/* Basic chatbot with default settings */}
      <KarjistoreChatBot />
    </div>
  );
}

// Example 2: Custom Message Handler
export function CustomHandlerExample() {
  const handleSendMessage = async (message: string): Promise<string> => {
    // Simulate API call
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      
      if (!response.ok) throw new Error('API Error');
      
      const data = await response.json();
      return data.reply;
    } catch (error) {
      console.error('Chat error:', error);
      return "I apologize, but I'm having trouble connecting right now. Please try again in a moment.";
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <KarjistoreChatBot 
        onSendMessage={handleSendMessage}
        title="Personal Shopper"
        subtitle="Ready to assist you"
        placeholder="Tell me about your style preferences..."
      />
    </div>
  );
}

// Example 3: Custom Quick Actions
export function CustomActionsExample() {
  const customActions = [
    { label: "New Arrivals", value: "Show me the latest arrivals", icon: Star },
    { label: "VIP Services", value: "Tell me about VIP membership", icon: Crown },
    { label: "Gift Cards", value: "I need a gift card", icon: Gift },
    { label: "Personal Styling", value: "Book a styling session", icon: Heart },
    { label: "Exclusive Items", value: "Show exclusive collections", icon: Sparkles },
    { label: "Limited Edition", value: "Any limited edition watches?", icon: Watch },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <KarjistoreChatBot 
        quickActions={customActions}
        welcomeMessage="Welcome to our exclusive luxury boutique! I'm here to provide personalized assistance for all your luxury shopping needs."
        title="Luxury Consultant"
        subtitle="Exclusive Service"
      />
    </div>
  );
}

// Example 4: E-commerce Integration
export function EcommerceExample() {
  const handleSendMessage = async (message: string): Promise<string> => {
    // Process different types of inquiries
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('price') || lowerMessage.includes('cost')) {
      return "Our luxury collections start from $299 for accessories, $899 for timepieces, and $199 for premium fragrances. Would you like to see specific items in your price range?";
    }
    
    if (lowerMessage.includes('shipping') || lowerMessage.includes('delivery')) {
      return "We offer complimentary white-glove delivery for orders over $500. Standard luxury packaging is included with all orders, with delivery within 2-3 business days.";
    }
    
    if (lowerMessage.includes('return') || lowerMessage.includes('exchange')) {
      return "We offer a 30-day satisfaction guarantee on all luxury items. Our concierge team will arrange complimentary pickup and exchange if you're not completely satisfied.";
    }
    
    // Default response for other inquiries
    return "Thank you for your interest in our luxury collections. How may I assist you today? I can help with product information, pricing, availability, or special services.";
  };

  const ecommerceActions = [
    { label: "Browse Catalog", value: "Show me your full catalog", icon: Star },
    { label: "Check Availability", value: "Check item availability", icon: Watch },
    { label: "Shipping Info", value: "Tell me about shipping options", icon: Gift },
    { label: "Returns Policy", value: "What's your return policy?", icon: Heart },
  ];

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-amber-50 py-4 px-6 border-b border-amber-100">
        <h1 className="text-2xl font-bold text-gray-900">Karjistore Luxury</h1>
        <p className="text-gray-600">Premium Fragrances & Timepieces</p>
      </header>
      
      <main className="container mx-auto py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sample product cards */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="h-48 bg-gray-100 rounded-lg mb-4"></div>
            <h3 className="font-semibold text-gray-900">Luxury Fragrance Set</h3>
            <p className="text-amber-600 font-bold">$299</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="h-48 bg-gray-100 rounded-lg mb-4"></div>
            <h3 className="font-semibold text-gray-900">Swiss Timepiece</h3>
            <p className="text-amber-600 font-bold">$899</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="h-48 bg-gray-100 rounded-lg mb-4"></div>
            <h3 className="font-semibold text-gray-900">Gift Collection</h3>
            <p className="text-amber-600 font-bold">$199</p>
          </div>
        </div>
      </main>
      
      <KarjistoreChatBot 
        onSendMessage={handleSendMessage}
        quickActions={ecommerceActions}
        welcomeMessage="Welcome to Karjistore! I'm your personal shopping assistant. I can help you find the perfect luxury items, check availability, or answer any questions about our collections."
        title="Shopping Assistant"
        subtitle="Online & Ready to Help"
        placeholder="Ask about products, prices, or services..."
      />
    </div>
  );
}

// Example 5: Multi-language Support
export function MultiLanguageExample() {
  const [language, setLanguage] = React.useState<'en' | 'es' | 'fr'>('en');
  
  const translations = {
    en: {
      title: "Luxury Concierge",
      subtitle: "Personal Assistant Available",
      welcome: "Welcome to your personal luxury shopping experience at Karjistore.",
      placeholder: "Share your luxury preferences...",
      actions: [
        { label: "Gift Sets", value: "Show me your gift sets", icon: Gift },
        { label: "Watches", value: "Show me your timepiece collection", icon: Watch },
        { label: "Perfumes", value: "What perfumes do you have?", icon: Sparkles },
        { label: "Bath & Body", value: "Show me bath and body products", icon: Heart },
      ]
    },
    es: {
      title: "Conserje de Lujo",
      subtitle: "Asistente Personal Disponible",
      welcome: "Bienvenido a tu experiencia personal de compras de lujo en Karjistore.",
      placeholder: "Comparte tus preferencias de lujo...",
      actions: [
        { label: "Sets de Regalo", value: "Muéstrame tus sets de regalo", icon: Gift },
        { label: "Relojes", value: "Muéstrame tu colección de relojes", icon: Watch },
        { label: "Perfumes", value: "¿Qué perfumes tienes?", icon: Sparkles },
        { label: "Baño y Cuerpo", value: "Muéstrame productos de baño", icon: Heart },
      ]
    },
    fr: {
      title: "Concierge de Luxe",
      subtitle: "Assistant Personnel Disponible",
      welcome: "Bienvenue dans votre expérience d'achat de luxe personnelle chez Karjistore.",
      placeholder: "Partagez vos préférences de luxe...",
      actions: [
        { label: "Coffrets Cadeaux", value: "Montrez-moi vos coffrets cadeaux", icon: Gift },
        { label: "Montres", value: "Montrez-moi votre collection de montres", icon: Watch },
        { label: "Parfums", value: "Quels parfums avez-vous?", icon: Sparkles },
        { label: "Bain et Corps", value: "Montrez-moi les produits de bain", icon: Heart },
      ]
    }
  };

  const currentTranslation = translations[language];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 bg-white border-b border-gray-200">
        <div className="flex gap-2">
          <button 
            onClick={() => setLanguage('en')}
            className={`px-3 py-1 rounded ${language === 'en' ? 'bg-amber-600 text-white' : 'bg-gray-200'}`}
          >
            English
          </button>
          <button 
            onClick={() => setLanguage('es')}
            className={`px-3 py-1 rounded ${language === 'es' ? 'bg-amber-600 text-white' : 'bg-gray-200'}`}
          >
            Español
          </button>
          <button 
            onClick={() => setLanguage('fr')}
            className={`px-3 py-1 rounded ${language === 'fr' ? 'bg-amber-600 text-white' : 'bg-gray-200'}`}
          >
            Français
          </button>
        </div>
      </div>
      
      <KarjistoreChatBot 
        title={currentTranslation.title}
        subtitle={currentTranslation.subtitle}
        welcomeMessage={currentTranslation.welcome}
        placeholder={currentTranslation.placeholder}
        quickActions={currentTranslation.actions}
      />
    </div>
  );
}

export default BasicChatExample;