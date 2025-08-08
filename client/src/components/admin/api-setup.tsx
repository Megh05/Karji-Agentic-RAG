import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, FlaskConical, Save } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ApiConfig {
  openrouterKey?: string;
  selectedModel?: string;
  temperature?: number;
  maxTokens?: number;
  hasApiKey?: boolean;
}

export default function ApiSetup() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [formData, setFormData] = useState<ApiConfig>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ["/api/config"],
    onSuccess: (data: ApiConfig) => {
      setFormData(data);
    }
  });

  const saveConfigMutation = useMutation({
    mutationFn: async (data: ApiConfig) => {
      const response = await apiRequest("POST", "/api/config", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "API configuration saved successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save configuration",
        variant: "destructive"
      });
    }
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/config/test", {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Success" : "Error",
        description: data.success ? "Connection test successful!" : data.error,
        variant: data.success ? "default" : "destructive"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to test connection",
        variant: "destructive"
      });
    }
  });

  const handleSave = () => {
    saveConfigMutation.mutate(formData);
  };

  const handleTest = () => {
    testConnectionMutation.mutate();
  };

  const models = [
    { value: "anthropic/claude-3-haiku", label: "Claude 3 Haiku" },
    { value: "openai/gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "mistralai/mixtral-8x7b-instruct", label: "Mixtral 8x7B Instruct" },
    { value: "meta-llama/llama-2-70b-chat", label: "Llama 2 70B Chat" }
  ];

  return (
    <div className="max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>OpenRouter API Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showApiKey ? "text" : "password"}
                placeholder="Enter your OpenRouter API key"
                value={formData.openrouterKey || ""}
                onChange={(e) => setFormData({ ...formData, openrouterKey: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Get your API key from <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OpenRouter.ai</a>
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label>Model Selection</Label>
            <Select 
              value={formData.selectedModel || ""} 
              onValueChange={(value) => setFormData({ ...formData, selectedModel: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a model..." />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Temperature and Max Tokens */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>Temperature: {formData.temperature || 0.7}</Label>
              <Slider
                value={[formData.temperature || 0.7]}
                onValueChange={(value) => setFormData({ ...formData, temperature: value[0] })}
                max={1}
                min={0}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Conservative</span>
                <span>Creative</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-tokens">Max Tokens</Label>
              <Input
                id="max-tokens"
                type="number"
                min={100}
                max={2000}
                value={formData.maxTokens || 500}
                onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <Button 
              onClick={handleTest} 
              variant="outline"
              disabled={testConnectionMutation.isPending}
            >
              <FlaskConical className="w-4 h-4 mr-2" />
              Test Connection
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saveConfigMutation.isPending}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connection Status */}
      {config && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full animate-pulse ${config.hasApiKey ? 'bg-secondary' : 'bg-yellow-500'}`}></div>
                <span className="text-sm font-medium">
                  {config.hasApiKey 
                    ? `Connected to ${config.selectedModel || 'OpenRouter API'}` 
                    : 'API Key Required'
                  }
                </span>
              </div>
              <Badge variant={config.hasApiKey ? "default" : "destructive"}>
                {config.hasApiKey ? "Connected" : "Not Connected"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
