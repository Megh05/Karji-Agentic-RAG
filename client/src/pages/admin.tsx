import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Key, Upload, Tag, Rss, Database, FileText } from "lucide-react";
import ApiSetup from "@/components/admin/api-setup";
import KnowledgeBase from "@/components/admin/knowledge-base";
import ProductOffers from "@/components/admin/product-offers";
import MerchantFeed from "@/components/admin/merchant-feed";
import { useQuery } from "@tanstack/react-query";
import type { Product, Document } from "@shared/schema";

export default function AdminPage() {
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"]
  });

  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ["/api/documents"]
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Admin Header */}
        <div className="chat-header">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-heading font-semibold text-foreground">Admin Dashboard</h2>
              <p className="text-sm text-muted-foreground">Configure your AI assistant and manage product data</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-xs text-muted-foreground">
                <Database className="w-3 h-3 inline mr-1" />
                <span>{products.length} products loaded</span>
              </div>
              <div className="text-xs text-muted-foreground">
                <FileText className="w-3 h-3 inline mr-1" />
                <span>{documents.length} documents</span>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <Tabs defaultValue="api-setup" className="w-full">
            <TabsList className="luxury-container grid w-full grid-cols-4 mb-6 p-1">
              <TabsTrigger value="api-setup" className="flex items-center space-x-2 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground text-sm">
                <Key className="w-3 h-3" />
                <span className="hidden sm:inline">OpenRouter API</span>
                <span className="sm:hidden">API</span>
              </TabsTrigger>
              <TabsTrigger value="knowledge-base" className="flex items-center space-x-2 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground text-sm">
                <Upload className="w-3 h-3" />
                <span className="hidden sm:inline">Knowledge Base</span>
                <span className="sm:hidden">KB</span>
              </TabsTrigger>
              <TabsTrigger value="product-offers" className="flex items-center space-x-2 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground text-sm">
                <Tag className="w-3 h-3" />
                <span className="hidden sm:inline">Product Offers</span>
                <span className="sm:hidden">Offers</span>
              </TabsTrigger>
              <TabsTrigger value="merchant-feed" className="flex items-center space-x-2 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground text-sm">
                <Rss className="w-3 h-3" />
                <span className="hidden sm:inline">Merchant Feed</span>
                <span className="sm:hidden">Feed</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="api-setup">
              <ApiSetup />
            </TabsContent>

            <TabsContent value="knowledge-base">
              <KnowledgeBase />
            </TabsContent>

            <TabsContent value="product-offers">
              <ProductOffers />
            </TabsContent>

            <TabsContent value="merchant-feed">
              <MerchantFeed />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
