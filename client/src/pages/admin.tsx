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
        {/* Admin Header - Compact */}
        <div className="luxury-container border-b backdrop-blur-sm px-4 py-3 lg:px-6 lg:py-4 bg-gradient-to-r from-card/90 to-muted/20">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center space-x-3">
              <div className="bot-avatar w-10 h-10 lg:w-12 lg:h-12">
                <Database className="w-4 h-4 lg:w-5 lg:h-5" />
              </div>
              <div>
                <h1 className="text-sm lg:text-base font-heading font-semibold text-foreground">Admin Dashboard</h1>
                <p className="text-xs text-muted-foreground">Configure AI Assistant & Manage Data</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="luxury-container px-3 py-1 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700">
                <div className="flex items-center space-x-2">
                  <Database className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{products.length}</span>
                </div>
              </div>
              <div className="luxury-container px-3 py-1 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700">
                <div className="flex items-center space-x-2">
                  <FileText className="w-3 h-3 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-semibold text-green-700 dark:text-green-300">{documents.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Content - Luxury Design */}
        <div className="flex-1 p-4 lg:p-6 overflow-y-auto message-area">
          <div className="max-w-6xl mx-auto">
            <Tabs defaultValue="api-setup" className="w-full">
              <TabsList className="luxury-container grid w-full grid-cols-4 mb-6 p-1 h-12 lg:h-14">
                <TabsTrigger 
                  value="api-setup" 
                  className="flex items-center justify-center space-x-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-luxury text-xs h-full px-1 rounded-lg font-medium"
                >
                  <Key className="w-3 h-3" />
                  <span className="hidden lg:inline">API</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="knowledge-base" 
                  className="flex items-center justify-center space-x-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-luxury text-xs h-full px-1 rounded-lg font-medium"
                >
                  <Upload className="w-3 h-3" />
                  <span className="hidden lg:inline">KB</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="product-offers" 
                  className="flex items-center justify-center space-x-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-luxury text-xs h-full px-1 rounded-lg font-medium"
                >
                  <Tag className="w-3 h-3" />
                  <span className="hidden lg:inline">Offers</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="merchant-feed" 
                  className="flex items-center justify-center space-x-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-luxury text-xs h-full px-1 rounded-lg font-medium"
                >
                  <Rss className="w-3 h-3" />
                  <span className="hidden lg:inline">Feed</span>
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
