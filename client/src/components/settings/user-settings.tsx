import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, Palette, MessageCircle, Bell, Shield, Eye, Sparkles, Volume2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UserSettings, InsertUserSettings } from "@shared/schema";

interface UserSettingsProps {
  sessionId: string;
  onClose?: () => void;
}

interface SettingsFormData {
  theme: string;
  accentColor: string;
  chatStyle: string;
  showProductImages: boolean;
  showPricing: boolean;
  autoSuggestions: boolean;
  communicationTone: string;
  language: string;
  rememberPreferences: boolean;
  shareData: boolean;
  soundEnabled: boolean;
  notifications: boolean;
  compactMode: boolean;
  animationsEnabled: boolean;
  anonymousMode: boolean;
}

export default function UserSettingsComponent({ sessionId, onClose }: UserSettingsProps) {
  const [formData, setFormData] = useState<SettingsFormData>({
    theme: "system",
    accentColor: "blue",
    chatStyle: "balanced",
    showProductImages: true,
    showPricing: true,
    autoSuggestions: true,
    communicationTone: "friendly",
    language: "en",
    rememberPreferences: true,
    shareData: true,
    soundEnabled: true,
    notifications: true,
    compactMode: false,
    animationsEnabled: true,
    anonymousMode: false,
  });

  const { toast } = useToast();

  // Fetch existing settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/settings", sessionId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/settings/${sessionId}`);
      return response.json();
    },
  });

  // Update form data when settings are loaded
  useEffect(() => {
    if (settings) {
      setFormData({
        theme: settings.theme || "system",
        accentColor: settings.accentColor || "blue",
        chatStyle: settings.chatStyle || "balanced",
        showProductImages: settings.showProductImages ?? true,
        showPricing: settings.showPricing ?? true,
        autoSuggestions: settings.autoSuggestions ?? true,
        communicationTone: settings.communicationTone || "friendly",
        language: settings.language || "en",
        rememberPreferences: settings.rememberPreferences ?? true,
        shareData: settings.shareData ?? true,
        soundEnabled: settings.soundEnabled ?? true,
        notifications: settings.notifications ?? true,
        compactMode: settings.compactMode ?? false,
        animationsEnabled: settings.animationsEnabled ?? true,
        anonymousMode: settings.anonymousMode ?? false,
      });
    }
  }, [settings]);

  // Save settings mutation
  const saveSettings = useMutation({
    mutationFn: async (data: Partial<InsertUserSettings>) => {
      const response = await apiRequest("PUT", `/api/settings/${sessionId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings saved",
        description: "Your preferences have been updated successfully.",
      });
    },
    onError: (error) => {
      console.error("Settings save error:", error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveSettings.mutate(formData);
  };

  const handleReset = () => {
    setFormData({
      theme: "system",
      accentColor: "blue",
      chatStyle: "balanced",
      showProductImages: true,
      showPricing: true,
      autoSuggestions: true,
      communicationTone: "friendly",
      language: "en",
      rememberPreferences: true,
      shareData: true,
      soundEnabled: true,
      notifications: true,
      compactMode: false,
      animationsEnabled: true,
      anonymousMode: false,
    });
    toast({
      title: "Settings reset",
      description: "All settings have been reset to default values.",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Settings className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Chat Settings</h2>
        </div>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      <Tabs defaultValue="appearance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="appearance" className="flex items-center space-x-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Appearance</span>
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center space-x-2">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Chat</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center space-x-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="display" className="flex items-center space-x-2">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Display</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Privacy</span>
          </TabsTrigger>
        </TabsList>

        {/* Appearance Settings */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Palette className="h-5 w-5" />
                <span>Appearance & Theme</span>
              </CardTitle>
              <CardDescription>
                Customize the visual appearance of your chat interface.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={formData.theme}
                    onValueChange={(value) => setFormData({ ...formData, theme: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred color scheme
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accentColor">Accent Color</Label>
                  <Select
                    value={formData.accentColor}
                    onValueChange={(value) => setFormData({ ...formData, accentColor: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select accent color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="amber">Amber</SelectItem>
                      <SelectItem value="emerald">Emerald</SelectItem>
                      <SelectItem value="purple">Purple</SelectItem>
                      <SelectItem value="rose">Rose</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Primary color used throughout the interface
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="animations">Enable Animations</Label>
                  <p className="text-sm text-muted-foreground">
                    Smooth transitions and visual effects
                  </p>
                </div>
                <Switch
                  id="animations"
                  checked={formData.animationsEnabled}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, animationsEnabled: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chat Settings */}
        <TabsContent value="chat">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageCircle className="h-5 w-5" />
                <span>Chat Behavior</span>
              </CardTitle>
              <CardDescription>
                Configure how the AI assistant communicates with you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="chatStyle">Chat Style</Label>
                  <Select
                    value={formData.chatStyle}
                    onValueChange={(value) => setFormData({ ...formData, chatStyle: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select chat style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concise">Concise</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    How detailed the AI responses should be
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="communicationTone">Communication Tone</Label>
                  <Select
                    value={formData.communicationTone}
                    onValueChange={(value) => setFormData({ ...formData, communicationTone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    The tone of voice for AI responses
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoSuggestions">Auto Suggestions</Label>
                    <p className="text-sm text-muted-foreground">
                      Show smart follow-up questions and quick actions
                    </p>
                  </div>
                  <Switch
                    id="autoSuggestions"
                    checked={formData.autoSuggestions}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, autoSuggestions: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="showProductImages">Show Product Images</Label>
                    <p className="text-sm text-muted-foreground">
                      Display product images in recommendations
                    </p>
                  </div>
                  <Switch
                    id="showProductImages"
                    checked={formData.showProductImages}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, showProductImages: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="showPricing">Show Pricing</Label>
                    <p className="text-sm text-muted-foreground">
                      Display prices and discount information
                    </p>
                  </div>
                  <Switch
                    id="showPricing"
                    checked={formData.showPricing}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, showPricing: checked })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Notifications & Sounds</span>
              </CardTitle>
              <CardDescription>
                Control notification preferences and audio settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notifications" className="flex items-center space-x-2">
                    <Bell className="h-4 w-4" />
                    <span>Enable Notifications</span>
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications for important updates
                  </p>
                </div>
                <Switch
                  id="notifications"
                  checked={formData.notifications}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, notifications: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="soundEnabled" className="flex items-center space-x-2">
                    <Volume2 className="h-4 w-4" />
                    <span>Sound Effects</span>
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Play sounds for messages and interactions
                  </p>
                </div>
                <Switch
                  id="soundEnabled"
                  checked={formData.soundEnabled}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, soundEnabled: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Display Settings */}
        <TabsContent value="display">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Eye className="h-5 w-5" />
                <span>Display Options</span>
              </CardTitle>
              <CardDescription>
                Customize how content is displayed in the chat interface.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="compactMode">Compact Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Use less spacing for a denser layout
                  </p>
                </div>
                <Switch
                  id="compactMode"
                  checked={formData.compactMode}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, compactMode: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select
                  value={formData.language}
                  onValueChange={(value) => setFormData({ ...formData, language: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Interface and communication language
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Settings */}
        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Privacy & Data</span>
              </CardTitle>
              <CardDescription>
                Control how your data is used and stored.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="rememberPreferences">Remember Preferences</Label>
                  <p className="text-sm text-muted-foreground">
                    Save your preferences for future sessions
                  </p>
                </div>
                <Switch
                  id="rememberPreferences"
                  checked={formData.rememberPreferences}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, rememberPreferences: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="shareData">Share Data for Improvements</Label>
                  <p className="text-sm text-muted-foreground">
                    Help improve the service by sharing anonymous usage data
                  </p>
                </div>
                <Switch
                  id="shareData"
                  checked={formData.shareData}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, shareData: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="anonymousMode">Anonymous Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Don't store any personal data or conversation history
                  </p>
                </div>
                <Switch
                  id="anonymousMode"
                  checked={formData.anonymousMode}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, anonymousMode: checked })
                  }
                />
              </div>

              {formData.anonymousMode && (
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    <strong>Note:</strong> Anonymous mode will disable personalization features and recommendations based on your preferences.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={saveSettings.isPending}
        >
          Reset to Defaults
        </Button>

        <div className="flex space-x-3">
          {onClose && (
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={saveSettings.isPending}
            >
              Cancel
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saveSettings.isPending}
            className="min-w-[100px]"
          >
            {saveSettings.isPending ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving...</span>
              </div>
            ) : (
              "Save Settings"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}