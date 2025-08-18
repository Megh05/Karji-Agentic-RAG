import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CloudUpload, Plus, Trash2, FileText, FileSpreadsheet, Settings } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Document } from "@shared/schema";

export default function KnowledgeBase() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customInstructions, setCustomInstructions] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ["/api/documents"]
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document uploaded successfully",
        variant: "success"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload document",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/documents/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document deleted successfully",
        variant: "success"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to delete document",
        variant: "destructive"
      });
    }
  });

  const saveInstructionsMutation = useMutation({
    mutationFn: async (instructions: string) => {
      const file = new Blob([instructions], { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', file, 'custom_instructions.txt');
      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Save failed');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Custom instructions saved successfully",
        variant: "success"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setCustomInstructions("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save custom instructions",
        variant: "destructive"
      });
    }
  });

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handleSaveInstructions = () => {
    if (!customInstructions.trim()) {
      toast({
        title: "Error",
        description: "Please enter some instructions before saving",
        variant: "destructive"
      });
      return;
    }
    saveInstructionsMutation.mutate(customInstructions);
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="text-red-600 dark:text-red-400" />;
    if (type.includes('sheet') || type.includes('csv')) return <FileSpreadsheet className="text-green-600 dark:text-green-400" />;
    return <FileText className="text-blue-600 dark:text-blue-400" />;
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${Math.floor(diffHours / 24)} days ago`;
  };

  return (
    <div className="max-w-4xl">
      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="documents">Document Upload</TabsTrigger>
          <TabsTrigger value="instructions">Custom Instructions</TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Base Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File Upload Area */}
              <div 
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={handleFileSelect}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="space-y-3">
                  <div className="text-4xl text-gray-400">
                    <CloudUpload className="w-16 h-16 mx-auto" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Drop files here or click to browse</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Supports PDF, Word, Excel, CSV files up to 10MB each</p>
                  </div>
                  <Button disabled={uploadMutation.isPending}>
                    <Plus className="w-4 h-4 mr-2" />
                    Select Files
                  </Button>
                </div>
              </div>

              {/* Upload Progress */}
              {uploadMutation.isPending && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Uploading document...</span>
                    <span className="text-sm text-gray-500">Processing</span>
                  </div>
                  <Progress value={75} className="w-full" />
                </div>
              )}

              {/* Uploaded Documents */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-700 dark:text-gray-300">Uploaded Documents</h4>
                
                {documents.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                    No documents uploaded yet. Upload your first document to get started.
                  </p>
                ) : (
                  documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center border border-gray-200 dark:border-gray-600">
                          {getFileIcon(doc.type)}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{doc.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {doc.size} • Added {formatDate(doc.uploadedAt || new Date())}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary">Processed</Badge>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => deleteMutation.mutate(doc.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Processing Options */}
              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-6">
                  <h5 className="font-medium text-blue-900 dark:text-blue-200 mb-4">Processing Settings</h5>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="chunking" defaultChecked />
                      <label htmlFor="chunking" className="text-sm text-blue-800 dark:text-blue-300">
                        Enable automatic text chunking
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="embeddings" defaultChecked />
                      <label htmlFor="embeddings" className="text-sm text-blue-800 dark:text-blue-300">
                        Generate embeddings for semantic search
                      </label>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-blue-800 dark:text-blue-300">Chunk size:</span>
                      <Select defaultValue="1000">
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="500">500 tokens</SelectItem>
                          <SelectItem value="1000">1000 tokens</SelectItem>
                          <SelectItem value="1500">1500 tokens</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instructions">
          <Card>
            <CardHeader>
              <CardTitle>Custom AI Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="instructions">Additional Instructions for AI Assistant</Label>
                <Textarea
                  id="instructions"
                  placeholder="Enter custom instructions for the AI assistant here...

Example:
- Always mention our premium warranty when recommending products
- Focus on eco-friendly products when customers ask about sustainability
- Suggest complementary products for upselling
- Use a friendly but professional tone"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  rows={12}
                  className="min-h-48"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  These instructions will be added to the AI's knowledge base and influence how it responds to customers.
                </p>
              </div>

              <div className="flex space-x-4">
                <Button 
                  onClick={handleSaveInstructions}
                  disabled={saveInstructionsMutation.isPending || !customInstructions.trim()}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  {saveInstructionsMutation.isPending ? "Saving..." : "Save Instructions"}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setCustomInstructions("")}
                  disabled={!customInstructions}
                >
                  Clear
                </Button>
              </div>

              {/* Current Custom Instructions */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-700 dark:text-gray-300">Current Custom Instructions</h4>
                {documents.filter(doc => doc.name.toLowerCase().includes('instruction')).length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center bg-gray-50 dark:bg-gray-800 rounded-lg">
                    No custom instructions saved yet.
                  </p>
                ) : (
                  documents.filter(doc => doc.name.toLowerCase().includes('instruction')).map((doc) => (
                    <div key={doc.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{doc.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Added {formatDate(doc.uploadedAt || new Date())}
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => deleteMutation.mutate(doc.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}