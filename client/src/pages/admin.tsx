import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Key, Upload, Tag, Rss, Database, FileText } from "lucide-react";
import ApiSetup from "@/components/admin/api-setup";
import KnowledgeBase from "@/components/admin/knowledge-base";
import ProductOffers from "@/components/admin/product-offers";
import MerchantFeed from "@/components/admin/merchant-feed";
import { useQuery } from "@tanstack/react-query";

export default function AdminPage() {
  const { data: products = [] } = useQuery({
    queryKey: ["/api/products"]
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["/api/documents"]
  });

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Admin Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Admin Dashboard</h2>
              <p className="text-gray-600 dark:text-gray-400">Configure your AI assistant and manage product data</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <Database className="w-4 h-4 inline mr-1" />
                <span>{products.length} products loaded</span>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <FileText className="w-4 h-4 inline mr-1" />
                <span>{documents.length} documents</span>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <Tabs defaultValue="api-setup" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="api-setup" className="flex items-center space-x-2">
                <Key className="w-4 h-4" />
                <span>OpenRouter API</span>
              </TabsTrigger>
              <TabsTrigger value="knowledge-base" className="flex items-center space-x-2">
                <Upload className="w-4 h-4" />
                <span>Knowledge Base</span>
              </TabsTrigger>
              <TabsTrigger value="product-offers" className="flex items-center space-x-2">
                <Tag className="w-4 h-4" />
                <span>Product Offers</span>
              </TabsTrigger>
              <TabsTrigger value="merchant-feed" className="flex items-center space-x-2">
                <Rss className="w-4 h-4" />
                <span>Merchant Feed</span>
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
