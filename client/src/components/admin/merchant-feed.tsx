import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderSync, CheckCircle, AlertCircle, TriangleAlert, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MerchantFeed, Product } from "@shared/schema";

export default function MerchantFeed() {
  const [feedUrl, setFeedUrl] = useState("https://karjistore.com/products/feed.xml");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: feeds = [] } = useQuery<MerchantFeed[]>({
    queryKey: ["/api/merchant-feeds"]
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"]
  });

  const createFeedMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/merchant-feeds", { url });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Merchant feed added successfully",
        variant: "success"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/merchant-feeds"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add merchant feed",
        variant: "destructive"
      });
    }
  });

  const syncFeedMutation = useMutation({
    mutationFn: async (feedId: string) => {
      const response = await apiRequest("POST", `/api/merchant-feeds/${feedId}/sync`, {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Feed synchronized successfully! ${data.productsImported} products imported.`,
        variant: "success"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/merchant-feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to sync merchant feed",
        variant: "destructive"
      });
    }
  });

  const handleAddFeed = () => {
    if (feedUrl.trim()) {
      createFeedMutation.mutate(feedUrl.trim());
    }
  };

  const handleSyncFeed = (feedId: string) => {
    syncFeedMutation.mutate(feedId);
  };

  const currentFeed = feeds[0]; // For demo, use first feed

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'Never';
    const d = new Date(date);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - d.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours ago`;
    return `${Math.floor(diffMinutes / 1440)} days ago`;
  };

  // Filter and search products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.brand?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || 
                           product.additionalFields?.product_type?.toLowerCase().includes(selectedCategory.toLowerCase());
    
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = [...new Set(products.map(p => p.additionalFields?.product_type?.split(' > ')[0]).filter(Boolean))];

  // Pagination logic
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

  const detectedFields = [
    { name: 'title', count: products.length },
    { name: 'description', count: products.length },
    { name: 'price', count: products.length },
    { name: 'availability', count: products.length },
    { name: 'image_link', count: products.filter(p => p.imageLink).length },
    { name: 'link', count: products.length },
    { name: 'brand', count: products.filter(p => p.brand).length },
    { name: 'condition', count: products.filter(p => p.condition).length },
  ];

  return (
    <div className="max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Google Merchant Feed Integration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Feed URL Input */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feed-url">XML Feed URL</Label>
              <div className="flex space-x-3">
                <Input
                  id="feed-url"
                  type="url"
                  placeholder="https://example.com/merchant-feed.xml"
                  value={feedUrl}
                  onChange={(e) => setFeedUrl(e.target.value)}
                />
                <Button 
                  onClick={handleAddFeed}
                  disabled={createFeedMutation.isPending}
                >
                  <FolderSync className="w-4 h-4 mr-2" />
                  Add Feed
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Enter your Google Merchant Center feed URL
              </p>
            </div>

            {/* FolderSync Options */}
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Checkbox id="auto-sync" defaultChecked />
                <label htmlFor="auto-sync" className="text-sm text-gray-700 dark:text-gray-300">
                  Auto-sync every 6 hours
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="embeddings" defaultChecked />
                <label htmlFor="embeddings" className="text-sm text-gray-700 dark:text-gray-300">
                  Generate embeddings for search
                </label>
              </div>
            </div>
          </div>

          {/* Feed Status */}
          {currentFeed && (
            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <CheckCircle className="text-white w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-green-900 dark:text-green-200">
                        Feed synchronized successfully
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {products.length} products imported • Last sync: {formatDate(currentFeed.lastSynced)}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline"
                    className="border-green-300 text-green-700 hover:bg-green-100 dark:border-green-600 dark:text-green-300 dark:hover:bg-green-900/20"
                    onClick={() => handleSyncFeed(currentFeed.id)}
                    disabled={syncFeedMutation.isPending}
                  >
                    Force Sync
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Field Mapping */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-700 dark:text-gray-300">Detected Fields</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {detectedFields.map((field) => (
                <div key={field.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center space-x-3">
                    {field.count === products.length ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : field.count > 0 ? (
                      <TriangleAlert className="w-4 h-4 text-yellow-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm font-medium">{field.name}</span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {field.count} items
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Product Catalog with Pagination */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-700 dark:text-gray-300">Product Catalog ({filteredProducts.length} products)</h4>
              <div className="flex items-center space-x-3">
                <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                  setItemsPerPage(parseInt(value));
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-500">per page</span>
              </div>
            </div>

            {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search products by title, description, or brand..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
              <div className="sm:w-48">
                <Select value={selectedCategory} onValueChange={(value) => {
                  setSelectedCategory(value);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Products Table */}
            {products.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                No products imported yet. Add and sync a merchant feed to see products here.
              </p>
            ) : filteredProducts.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                No products match your search criteria.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="text-left p-3 font-medium">Product</th>
                        <th className="text-left p-3 font-medium">Category</th>
                        <th className="text-left p-3 font-medium">Price</th>
                        <th className="text-left p-3 font-medium">Availability</th>
                        <th className="text-left p-3 font-medium">Brand</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProducts.map((product) => (
                        <tr key={product.id} className="border-t border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="p-3">
                            <div className="flex items-center space-x-3">
                              {product.imageLink && (
                                <img 
                                  src={product.imageLink} 
                                  alt={product.title}
                                  className="w-10 h-10 rounded object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=50&h=50`;
                                  }}
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate max-w-xs">{product.title}</p>
                                <p className="text-xs text-gray-500 truncate max-w-xs">{product.description}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="text-xs bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">
                              {product.additionalFields?.product_type?.split(' > ')[0] || 'N/A'}
                            </span>
                          </td>
                          <td className="p-3 font-medium">{product.price || 'N/A'}</td>
                          <td className="p-3">
                            <Badge 
                              variant={product.availability === 'in stock' ? 'default' : 'secondary'}
                              className={product.availability === 'in stock' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}
                            >
                              {product.availability || 'Unknown'}
                            </Badge>
                          </td>
                          <td className="p-3">{product.brand || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredProducts.length)} of {filteredProducts.length} products
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      
                      <div className="flex space-x-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNum = currentPage <= 3 ? i + 1 : 
                                        currentPage >= totalPages - 2 ? totalPages - 4 + i :
                                        currentPage - 2 + i;
                          return (
                            <Button
                              key={pageNum}
                              variant={pageNum === currentPage ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className="w-8 h-8 p-0"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
