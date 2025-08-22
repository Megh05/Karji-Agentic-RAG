import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Check, 
  X, 
  Star, 
  Heart, 
  ShoppingCart, 
  GitCompare,
  Sparkles,
  DollarSign
} from "lucide-react";

interface Product {
  id: string;
  title: string;
  brand?: string;
  price?: string;
  discountPrice?: string;
  description?: string;
  imageLink?: string;
  category?: string;
  availability?: string;
  features?: string[];
}

interface ProductComparisonProps {
  products: Product[];
  onSelectProduct?: (productId: string) => void;
  onAddToWishlist?: (productId: string) => void;
}

export default function ProductComparison({ 
  products = [], 
  onSelectProduct,
  onAddToWishlist 
}: ProductComparisonProps) {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  if (products.length < 2) {
    return (
      <div className="text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <GitCompare className="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-600 dark:text-gray-300">
          Need at least 2 products to compare. Ask me to show you some options!
        </p>
      </div>
    );
  }

  const comparisonProducts = products.slice(0, 3); // Limit to 3 for better display

  // Extract common features for comparison
  const getComparisonFeatures = () => {
    const features = [
      { key: 'brand', label: 'Brand' },
      { key: 'price', label: 'Price' },
      { key: 'category', label: 'Category' },
      { key: 'availability', label: 'Availability' },
      { key: 'description', label: 'Description' }
    ];
    return features;
  };

  const formatPrice = (price?: string, discountPrice?: string) => {
    if (discountPrice && discountPrice !== price) {
      return (
        <div className="space-y-1">
          <span className="text-lg font-bold text-green-600">{discountPrice}</span>
          <span className="text-sm text-gray-500 line-through block">{price}</span>
        </div>
      );
    }
    return <span className="text-lg font-bold">{price || 'Contact for price'}</span>;
  };

  const getAvailabilityBadge = (availability?: string) => {
    const status = availability?.toLowerCase();
    if (status === 'in_stock' || status === 'in stock') {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">In Stock</Badge>;
    } else if (status === 'limited' || status === 'low stock') {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Limited</Badge>;
    } else if (status === 'out_of_stock' || status === 'out of stock') {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Out of Stock</Badge>;
    }
    return <Badge variant="outline">Check Availability</Badge>;
  };

  return (
    <div className="space-y-4" data-testid="product-comparison">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <GitCompare className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Product Comparison</h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          {comparisonProducts.length} Products
        </Badge>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-full">
          {comparisonProducts.map((product, index) => (
            <Card 
              key={product.id} 
              className={`relative transition-all duration-200 ${
                selectedProduct === product.id ? 'ring-2 ring-primary shadow-lg' : ''
              }`}
              data-testid={`comparison-product-${index}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base line-clamp-2">{product.title}</CardTitle>
                    {product.brand && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{product.brand}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onAddToWishlist?.(product.id)}
                    className="ml-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                    data-testid={`wishlist-${product.id}`}
                  >
                    <Heart className="w-4 h-4 text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Price */}
                <div className="text-center">
                  {formatPrice(product.price, product.discountPrice)}
                  {product.discountPrice && product.price !== product.discountPrice && (
                    <div className="flex items-center justify-center mt-1">
                      <Sparkles className="w-3 h-3 text-green-500 mr-1" />
                      <span className="text-xs text-green-600">Special Offer</span>
                    </div>
                  )}
                </div>

                {/* Availability */}
                <div className="flex justify-center">
                  {getAvailabilityBadge(product.availability)}
                </div>

                {/* Category */}
                {product.category && (
                  <div className="text-center">
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {product.category}
                    </span>
                  </div>
                )}

                {/* Description Preview */}
                {product.description && (
                  <div className="text-center">
                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3">
                      {product.description.substring(0, 100)}...
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={() => {
                      setSelectedProduct(product.id);
                      onSelectProduct?.(product.id);
                    }}
                    data-testid={`select-product-${product.id}`}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    {selectedProduct === product.id ? 'Selected' : 'Choose This'}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => onSelectProduct?.(product.id)}
                  >
                    View Details
                  </Button>
                </div>
              </CardContent>

              {/* Selection Indicator */}
              {selectedProduct === product.id && (
                <div className="absolute top-2 right-2 bg-primary text-white rounded-full p-1">
                  <Check className="w-3 h-3" />
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>


    </div>
  );
}