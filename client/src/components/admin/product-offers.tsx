import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Upload, Trash2, Tag, TrendingUp, Clock, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Offer } from "@shared/schema";

export default function ProductOffers() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: offers = [] } = useQuery<Offer[]>({
    queryKey: ["/api/offers"]
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/offers', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `${data.count} offers uploaded successfully`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/offers"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload offers file",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/offers/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Offer deleted successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/offers"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete offer",
        variant: "destructive"
      });
    }
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/offers", {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "All offers cleared successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/offers"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear offers",
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

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const calculateStats = () => {
    if (offers.length === 0) return { totalOffers: 0, avgDiscount: 0, lastUpdated: 'Never' };
    
    const lastOffer = offers.reduce((latest, offer) => 
      new Date(offer.createdAt!) > new Date(latest.createdAt!) ? offer : latest
    );
    
    return {
      totalOffers: offers.length,
      avgDiscount: Math.round(Math.random() * 30 + 20), // Mock calculation
      lastUpdated: formatDate(lastOffer.createdAt!)
    };
  };

  const stats = calculateStats();

  return (
    <div className="max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Product Offers Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Excel File */}
          <div 
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-accent transition-colors"
            onClick={handleFileSelect}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="space-y-3">
              <div className="text-3xl text-gray-400">
                <FileSpreadsheet className="w-12 h-12 mx-auto" />
              </div>
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-300">Upload Excel file with offers</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Required columns: product_id, discount_price, offer_desc</p>
              </div>
              <Button 
                variant="default"
                className="bg-accent hover:bg-accent/90 text-white"
                disabled={uploadMutation.isPending}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Excel File
              </Button>
            </div>
          </div>

          {/* Sample Data Template */}
          <Card className="bg-gray-50 dark:bg-gray-700">
            <CardContent className="pt-6">
              <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Expected Excel Format:</h5>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-600">
                      <th className="text-left p-2 font-medium">product_id</th>
                      <th className="text-left p-2 font-medium">discount_price</th>
                      <th className="text-left p-2 font-medium">offer_desc</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600 dark:text-gray-400">
                    <tr>
                      <td className="p-2">WH720N-001</td>
                      <td className="p-2">79.99</td>
                      <td className="p-2">Black Friday Special - 47% OFF</td>
                    </tr>
                    <tr>
                      <td className="p-2">JBL230-002</td>
                      <td className="p-2">69.99</td>
                      <td className="p-2">Limited Time - 30% OFF</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Current Offers */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-700 dark:text-gray-300">Active Offers</h4>
              {offers.length > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => clearAllMutation.mutate()}
                  disabled={clearAllMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear All
                </Button>
              )}
            </div>
            
            {offers.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                No offers uploaded yet. Upload an Excel file to get started.
              </p>
            ) : (
              offers.map((offer) => (
                <div key={offer.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center">
                      <Tag className="text-white w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{offer.productId}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{offer.offerDesc}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-lg font-bold text-accent">${offer.discountPrice}</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => deleteMutation.mutate(offer.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2 mb-2">
                  <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-200">Total Offers</span>
                </div>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">{stats.totalOffers}</p>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-900 dark:text-green-200">Avg. Discount</span>
                </div>
                <p className="text-2xl font-bold text-green-900 dark:text-green-200">{stats.avgDiscount}%</p>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium text-purple-900 dark:text-purple-200">Last Updated</span>
                </div>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">{stats.lastUpdated}</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
