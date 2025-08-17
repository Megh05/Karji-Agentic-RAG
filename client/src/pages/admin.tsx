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
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-amber-50/30 via-yellow-50/20 to-orange-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Admin Header - Luxury Design */}
        <div className="chat-header flex-shrink-0">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center space-x-3 lg:space-x-4">
              <div className="bot-avatar">
                <Database className="w-5 h-5 lg:w-6 lg:h-6" />
              </div>
              <div>
                <h1 className="text-base lg:text-lg font-heading font-semibold text-foreground">Admin Dashboard</h1>
                <p className="text-xs text-muted-foreground">Configure AI Assistant & Manage Data</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 lg:space-x-4">
              <div className="luxury-container px-2 lg:px-4 py-1 lg:py-2 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700">
                <div className="flex items-center space-x-2 lg:space-x-3">
                  <Database className="w-3 h-3 lg:w-4 lg:h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs lg:text-sm font-semibold text-blue-700 dark:text-blue-300">{products.length} Products</span>
                </div>
              </div>
              <div className="luxury-container px-2 lg:px-4 py-1 lg:py-2 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700">
                <div className="flex items-center space-x-2 lg:space-x-3">
                  <FileText className="w-3 h-3 lg:w-4 lg:h-4 text-green-600 dark:text-green-400" />
                  <span className="text-xs lg:text-sm font-semibold text-green-700 dark:text-green-300">{documents.length} Docs</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Content - Luxury Design */}
        <div className="flex-1 p-4 lg:p-6 overflow-y-auto message-area">
          <div className="max-w-6xl mx-auto">
            <Tabs defaultValue="api-setup" className="w-full">
              <TabsList className="luxury-container grid w-full grid-cols-2 lg:grid-cols-4 mb-6 p-1 h-12 lg:h-14">
                <TabsTrigger 
                  value="api-setup" 
                  className="flex items-center justify-center space-x-1 lg:space-x-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-luxury text-xs lg:text-sm h-full px-2 lg:px-3 rounded-lg font-medium"
                >
                  <Key className="w-3 h-3 lg:w-4 lg:h-4" />
                  <span className="hidden sm:inline">OpenRouter API</span>
                  <span className="sm:hidden">API</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="knowledge-base" 
                  className="flex items-center justify-center space-x-1 lg:space-x-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-luxury text-xs lg:text-sm h-full px-2 lg:px-3 rounded-lg font-medium"
                >
                  <Upload className="w-3 h-3 lg:w-4 lg:h-4" />
                  <span className="hidden sm:inline">Knowledge Base</span>
                  <span className="sm:hidden">KB</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="product-offers" 
                  className="flex items-center justify-center space-x-1 lg:space-x-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-luxury text-xs lg:text-sm h-full px-2 lg:px-3 rounded-lg font-medium"
                >
                  <Tag className="w-3 h-3 lg:w-4 lg:h-4" />
                  <span className="hidden sm:inline">Product Offers</span>
                  <span className="sm:hidden">Offers</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="merchant-feed" 
                  className="flex items-center justify-center space-x-1 lg:space-x-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-luxury text-xs lg:text-sm h-full px-2 lg:px-3 rounded-lg font-medium"
                >
                  <Rss className="w-3 h-3 lg:w-4 lg:h-4" />
                  <span className="hidden sm:inline">Merchant Feed</span>
                  <span className="sm:hidden">Feed</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="api-setup" className="luxury-container p-6 space-y-6">
                <ApiSetup />
              </TabsContent>

              <TabsContent value="knowledge-base" className="luxury-container p-6 space-y-6">
                <KnowledgeBase />
              </TabsContent>

              <TabsContent value="product-offers" className="luxury-container p-6 space-y-6">
                <ProductOffers />
              </TabsContent>

              <TabsContent value="merchant-feed" className="luxury-container p-6 space-y-6">
                <MerchantFeed />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
