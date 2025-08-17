import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette, Check, Sparkles, Crown, Diamond, Gem } from "lucide-react";

interface LuxuryTheme {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    accent: string;
  };
  preview: string;
  icon: React.ReactNode;
  className: string;
}

const luxuryThemes: LuxuryTheme[] = [
  {
    id: "midnight-platinum",
    name: "Midnight Platinum",
    description: "Deep sophistication with champagne gold accents",
    colors: {
      primary: "#D4AF37", // Champagne gold
      secondary: "#2C3E50", // Sophisticated navy
      background: "#1A1F2E", // Deep midnight
      accent: "#F8F9FA"      // Platinum white
    },
    preview: "bg-gradient-to-br from-amber-600 via-slate-800 to-slate-900",
    icon: <Crown className="h-5 w-5" />,
    className: "theme-midnight-platinum"
  },
  {
    id: "pearl-obsidian",
    name: "Pearl Obsidian",
    description: "Elegant light luxury with sapphire navy highlights",
    colors: {
      primary: "#1E3A8A", // Rich sapphire navy
      secondary: "#F3F4F6", // Soft silver-gray
      background: "#FEFEFE", // Pearl white
      accent: "#92400E"      // Antique gold
    },
    preview: "bg-gradient-to-br from-blue-900 via-gray-100 to-white",
    icon: <Diamond className="h-5 w-5" />,
    className: "theme-pearl-obsidian"
  },
  {
    id: "rose-gold-velvet",
    name: "Rose Gold Velvet",
    description: "Warm sophisticated luxury with burgundy depth",
    colors: {
      primary: "#E67E22", // Rose gold
      secondary: "#8B4513", // Deep wine
      background: "#2C1810", // Deep burgundy-black
      accent: "#FDF2E9"      // Warm cream
    },
    preview: "bg-gradient-to-br from-orange-400 via-amber-800 to-red-900",
    icon: <Gem className="h-5 w-5" />,
    className: "theme-rose-gold-velvet"
  },
  {
    id: "emerald-platinum",
    name: "Emerald Platinum",
    description: "Sophisticated green luxury with champagne highlights",
    colors: {
      primary: "#059669", // Elegant emerald
      secondary: "#064E3B", // Deep jade
      background: "#0F2027", // Deep forest green
      accent: "#F7FAFC"      // Platinum white
    },
    preview: "bg-gradient-to-br from-emerald-600 via-green-800 to-gray-900",
    icon: <Sparkles className="h-5 w-5" />,
    className: "theme-emerald-platinum"
  },
  {
    id: "royal-purple",
    name: "Royal Purple Luxe",
    description: "Majestic sophistication with brilliant gold accents",
    colors: {
      primary: "#7C3AED", // Royal purple
      secondary: "#581C87", // Deep amethyst
      background: "#1E1B4B", // Deep royal purple
      accent: "#FEF3C7"      // Brilliant gold
    },
    preview: "bg-gradient-to-br from-purple-600 via-purple-900 to-indigo-900",
    icon: <Crown className="h-5 w-5" />,
    className: "theme-royal-purple"
  }
];

interface ThemeSelectorProps {
  currentTheme?: string;
  onThemeSelect: (theme: LuxuryTheme) => void;
}

export default function ThemeSelector({ currentTheme, onThemeSelect }: ThemeSelectorProps) {
  const [selectedTheme, setSelectedTheme] = useState<string>(currentTheme || "midnight-platinum");

  const handleThemeSelect = (theme: LuxuryTheme) => {
    setSelectedTheme(theme.id);
    onThemeSelect(theme);
    
    // Apply theme to document
    document.documentElement.className = theme.className;
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center space-x-2">
          <Palette className="h-6 w-6 text-primary" />
          <h3 className="text-2xl font-bold font-luxury-display">Luxury Theme Collection</h3>
        </div>
        <p className="text-muted-foreground">Choose your sophisticated aesthetic</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {luxuryThemes.map((theme) => (
          <Card 
            key={theme.id} 
            className={`luxury-hover cursor-pointer transition-all duration-300 ${
              selectedTheme === theme.id ? 'ring-2 ring-primary luxury-glow-animation' : ''
            }`}
            onClick={() => handleThemeSelect(theme)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-lg"
                    style={{ backgroundColor: theme.colors.primary }}
                  >
                    {theme.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg font-luxury-display">{theme.name}</CardTitle>
                    {selectedTheme === theme.id && (
                      <Badge variant="default" className="mt-1">
                        <Check className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <CardDescription className="text-sm font-luxury-sans">
                {theme.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-0 space-y-4">
              {/* Color Palette Preview */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Color Palette
                </p>
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
              </div>

              {/* Gradient Preview */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Style Preview
                </p>
                <div className={`h-16 rounded-lg ${theme.preview} relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent luxury-shimmer" />
                  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-white text-xs">
                    <span className="font-luxury-sans">KarjiStore</span>
                    <span className="font-luxury-serif">Luxury</span>
                  </div>
                </div>
              </div>

              <Button
                variant={selectedTheme === theme.id ? "default" : "outline"}
                className="w-full font-luxury-sans"
                onClick={(e) => {
                  e.stopPropagation();
                  handleThemeSelect(theme);
                }}
              >
                {selectedTheme === theme.id ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Applied
                  </>
                ) : (
                  <>
                    <Palette className="h-4 w-4 mr-2" />
                    Apply Theme
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center pt-4 border-t">
        <p className="text-sm text-muted-foreground font-luxury-sans">
          Each theme includes sophisticated color palettes, premium typography, and elegant visual effects
        </p>
      </div>
    </div>
  );
}