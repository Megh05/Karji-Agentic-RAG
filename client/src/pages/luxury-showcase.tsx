import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Diamond, Gem, Sparkles, Palette, Bot, Settings, Send, Star } from "lucide-react";

const luxuryThemes = [
  {
    id: "midnight-platinum",
    name: "Midnight Platinum",
    description: "Deep sophistication with champagne gold accents",
    mood: "Exclusive & Prestigious",
    colors: {
      primary: "#D4AF37",
      secondary: "#2C3E50", 
      background: "#1A1F2E",
      accent: "#F8F9FA"
    },
    preview: "bg-gradient-to-br from-yellow-600 via-slate-800 to-slate-900",
    icon: <Crown className="h-6 w-6" />,
    features: ["Glass morphism effects", "Gold shimmer animations", "Premium typography", "Deep shadows"],
    bestFor: "High-end fragrance collections, VIP customers, luxury positioning"
  },
  {
    id: "pearl-obsidian", 
    name: "Pearl Obsidian",
    description: "Elegant light luxury with sapphire navy highlights",
    mood: "Refined & Sophisticated",
    colors: {
      primary: "#1E3A8A",
      secondary: "#F3F4F6",
      background: "#FEFEFE", 
      accent: "#92400E"
    },
    preview: "bg-gradient-to-br from-blue-900 via-gray-100 to-white",
    icon: <Diamond className="h-6 w-6" />,
    features: ["Clean minimalism", "Subtle luxury accents", "Professional aesthetics", "High contrast"],
    bestFor: "Corporate clients, daytime shopping, professional consultations"
  },
  {
    id: "rose-gold-velvet",
    name: "Rose Gold Velvet", 
    description: "Warm sophisticated luxury with burgundy depth",
    mood: "Intimate & Luxurious",
    colors: {
      primary: "#E67E22",
      secondary: "#8B4513",
      background: "#2C1810",
      accent: "#FDF2E9"
    },
    preview: "bg-gradient-to-br from-orange-400 via-amber-800 to-red-900",
    icon: <Gem className="h-6 w-6" />,
    features: ["Warm color palette", "Velvet textures", "Rose gold highlights", "Cozy ambiance"],
    bestFor: "Evening collections, romantic fragrances, gift experiences"
  },
  {
    id: "emerald-platinum",
    name: "Emerald Platinum",
    description: "Sophisticated green luxury with champagne highlights", 
    mood: "Fresh & Elegant",
    colors: {
      primary: "#059669",
      secondary: "#064E3B",
      background: "#0F2027",
      accent: "#F7FAFC"
    },
    preview: "bg-gradient-to-br from-emerald-600 via-green-800 to-gray-900",
    icon: <Sparkles className="h-6 w-6" />,
    features: ["Nature-inspired luxury", "Emerald accents", "Fresh aesthetics", "Organic sophistication"],
    bestFor: "Natural fragrances, eco-luxury brands, modern collections"
  },
  {
    id: "royal-purple",
    name: "Royal Purple Luxe",
    description: "Majestic sophistication with brilliant gold accents",
    mood: "Majestic & Opulent", 
    colors: {
      primary: "#7C3AED",
      secondary: "#581C87",
      background: "#1E1B4B",
      accent: "#FEF3C7"
    },
    preview: "bg-gradient-to-br from-purple-600 via-purple-900 to-indigo-900",
    icon: <Crown className="h-6 w-6" />,
    features: ["Royal color scheme", "Majestic presence", "Gold highlights", "Luxury authority"],
    bestFor: "Premium collections, exclusive releases, luxury brand positioning"
  }
];

export default function LuxuryShowcase() {
  const [selectedTheme, setSelectedTheme] = useState("midnight-platinum");
  const currentTheme = luxuryThemes.find(t => t.id === selectedTheme);

  const applyTheme = (themeId: string) => {
    setSelectedTheme(themeId);
    const theme = luxuryThemes.find(t => t.id === themeId);
    if (theme) {
      document.documentElement.className = `theme-${themeId}`;
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Luxury Background */}
      <div className="absolute inset-0 luxury-gradient-bg opacity-10"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent luxury-shimmer"></div>
      
      <div className="relative z-10 container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 py-8">
          <div className="flex items-center justify-center space-x-3">
            <div className="luxury-glow-animation w-16 h-16 luxury-gradient-bg rounded-3xl flex items-center justify-center shadow-2xl">
              <Palette className="text-white w-8 h-8" />
            </div>
            <div>
              <h1 className="text-5xl font-luxury-display font-bold text-foreground luxury-text-glow">
                KarjiStore Luxury Themes
              </h1>
              <p className="text-xl text-muted-foreground font-luxury-sans mt-2">
                Choose your sophisticated aesthetic experience
              </p>
            </div>
          </div>
        </div>

        {/* Current Theme Preview */}
        {currentTheme && (
          <Card className="card-luxury luxury-shadow mb-8">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
                  style={{ backgroundColor: currentTheme.colors.primary }}
                >
                  {currentTheme.icon}
                </div>
                <div>
                  <CardTitle className="text-3xl font-luxury-display">{currentTheme.name}</CardTitle>
                  <Badge variant="outline" className="mt-2">{currentTheme.mood}</Badge>
                </div>
              </div>
              <CardDescription className="text-lg font-luxury-sans">
                {currentTheme.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Live Preview */}
              <div className="luxury-glass rounded-3xl p-8 space-y-6">
                <h3 className="text-2xl font-luxury-display mb-4">Live Interface Preview</h3>
                
                {/* Mock Chat Header */}
                <div className="luxury-glass border border-border/30 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 luxury-gradient-bg rounded-2xl flex items-center justify-center shadow-lg">
                        <Bot className="text-white w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-lg font-luxury-display font-bold">KarjiStore Concierge</h4>
                        <p className="text-sm text-muted-foreground font-luxury-sans">Your luxury advisor</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="icon" className="luxury-hover rounded-xl">
                        <Settings className="h-4 w-4" />
                      </Button>
                      <div className="luxury-glass px-3 py-2 rounded-xl">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                          <span className="text-sm font-luxury-sans">Premium Active</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mock Message */}
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 luxury-gradient-bg rounded-2xl flex items-center justify-center shadow-md">
                    <Bot className="text-white w-5 h-5" />
                  </div>
                  <div className="luxury-glass rounded-2xl rounded-tl-sm p-4 max-w-md">
                    <p className="font-luxury-sans">Welcome to KarjiStore! I'm here to help you discover exquisite fragrances that match your sophisticated taste.</p>
                  </div>
                </div>

                {/* Mock Input */}
                <div className="luxury-glass border border-border/30 rounded-2xl p-4">
                  <div className="flex space-x-3">
                    <div className="flex-1">
                      <div className="input-luxury h-12 rounded-2xl px-4 flex items-center">
                        <span className="text-muted-foreground font-luxury-sans">Share your luxury preferences...</span>
                      </div>
                    </div>
                    <Button className="btn-luxury-primary h-12 px-6 rounded-2xl">
                      <Send className="w-4 h-4 mr-2" />
                      Send
                    </Button>
                  </div>
                </div>
              </div>

              {/* Features & Best For */}
              <div className="grid md:grid-cols-2 gap-6 mt-6">
                <div>
                  <h4 className="font-luxury-display text-lg mb-3">Key Features</h4>
                  <ul className="space-y-2">
                    {currentTheme.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center space-x-2 text-sm font-luxury-sans">
                        <Star className="w-4 h-4 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-luxury-display text-lg mb-3">Best For</h4>
                  <p className="text-sm text-muted-foreground font-luxury-sans">{currentTheme.bestFor}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Theme Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {luxuryThemes.map((theme) => (
            <Card 
              key={theme.id} 
              className={`luxury-hover cursor-pointer transition-all duration-300 ${
                selectedTheme === theme.id ? 'ring-2 ring-primary luxury-glow-animation' : ''
              }`}
              onClick={() => applyTheme(theme.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg"
                      style={{ backgroundColor: theme.colors.primary }}
                    >
                      {theme.icon}
                    </div>
                    <div>
                      <CardTitle className="font-luxury-display">{theme.name}</CardTitle>
                      <Badge variant="outline" className="mt-1">{theme.mood}</Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <CardDescription className="font-luxury-sans">{theme.description}</CardDescription>
                
                {/* Color Preview */}
                <div className="flex space-x-2">
                  <div 
                    className="w-8 h-8 rounded-lg shadow-inner"
                    style={{ backgroundColor: theme.colors.background }}
                    title="Background"
                  />
                  <div 
                    className="w-8 h-8 rounded-lg shadow-inner"
                    style={{ backgroundColor: theme.colors.primary }}
                    title="Primary"
                  />
                  <div 
                    className="w-8 h-8 rounded-lg shadow-inner"
                    style={{ backgroundColor: theme.colors.secondary }}
                    title="Secondary"
                  />
                  <div 
                    className="w-8 h-8 rounded-lg shadow-inner"
                    style={{ backgroundColor: theme.colors.accent }}
                    title="Accent"
                  />
                </div>

                {/* Gradient Preview */}
                <div className={`h-12 rounded-lg ${theme.preview} relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent luxury-shimmer" />
                </div>

                <Button
                  variant={selectedTheme === theme.id ? "default" : "outline"}
                  className="w-full font-luxury-sans"
                  onClick={(e) => {
                    e.stopPropagation();
                    applyTheme(theme.id);
                  }}
                >
                  {selectedTheme === theme.id ? "Applied" : "Apply Theme"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="text-center space-y-4 pt-8">
          <Button 
            className="btn-luxury-primary px-8 py-4 text-lg font-luxury-sans"
            onClick={() => window.location.href = '/chat'}
          >
            Experience Your Luxury Theme
          </Button>
          <p className="text-sm text-muted-foreground font-luxury-sans">
            All themes include sophisticated animations, premium typography, and glass morphism effects
          </p>
        </div>
      </div>
    </div>
  );
}