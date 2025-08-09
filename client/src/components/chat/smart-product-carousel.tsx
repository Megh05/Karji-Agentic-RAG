import { useState } from "react";
import { ChevronLeft, ChevronRight, ShoppingCart, Eye, BarChart3, Heart, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Product } from "@shared/schema";

interface SmartProductCarouselProps {
  products: Product[];
  uiElements?: {
    showCarousel?: boolean;
    showFilters?: boolean;
    showComparison?: boolean;
    quickActions?: string[];
    urgencyIndicators?: string[];
    socialProof?: string[];
  };
  onProductAction?: (action: string, productId: string, extra?: any) => void;
}

export default function SmartProductCarousel({ 
  products, 
  uiElements = {}, 
  onProductAction 
}: SmartProductCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const { 
    showCarousel = true, 
    showFilters = false, 
    showComparison = false,
    quickActions = ['View Details', 'Add to Cart'],
    urgencyIndicators = [],
    socialProof = []
  } = uiElements;

  if (!products || products.length === 0) return null;

  const itemsPerView = showCarousel ? 2 : 3;
  const maxIndex = Math.max(0, products.length - itemsPerView);

  const nextSlide = () => {
    setCurrentIndex(prev => Math.min(prev + 1, maxIndex));
  };

  const prevSlide = () => {
    setCurrentIndex(prev => Math.max(prev - 1, 0));
  };

  const handleProductSelect = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleQuickAction = (action: string, product: Product) => {
    if (onProductAction) {
      onProductAction(action.toLowerCase().replace(/\s+/g, '_'), product.id, product);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'add to cart': return <ShoppingCart className="w-4 h-4" />;
      case 'view details': return <Eye className="w-4 h-4" />;
      case 'compare': return <BarChart3 className="w-4 h-4" />;
      case 'save for later': return <Heart className="w-4 h-4" />;
      default: return null;
    }
  };

  const getSpecialFeatureOptions = (product: Product) => {
    const options: string[] = [];
    
    // For perfumes - scent types
    if (product.title?.toLowerCase().includes('perfume') || 
        product.title?.toLowerCase().includes('fragrance')) {
      options.push('Choose Scent Type', 'Size Options', 'Gift Wrap');
    }
    
    // For watches - collection types
    if (product.title?.toLowerCase().includes('watch')) {
      options.push('Watch Collection', 'Band Material', 'Face Color');
    }
    
    // For general products
    options.push('Color Options', 'Size Guide', 'Delivery Options');
    
    return options;
  };

  const formatPrice = (price: string | null | undefined) => {
    if (!price) return 'Price on request';
    return price.includes('AED') ? price : `${price} AED`;
  };

  return (
    <div className="w-full space-y-4">
      {/* Filters Section */}
      {showFilters && (
        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Filter className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          <span className="font-medium">Smart Filters:</span>
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="price_low">Price: Low to High</SelectItem>
              <SelectItem value="price_high">Price: High to Low</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="new">New Arrivals</SelectItem>
              <SelectItem value="discount">Best Deals</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Urgency Indicators */}
      {urgencyIndicators.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urgencyIndicators.map((indicator, index) => (
            <Badge key={index} variant="destructive" className="animate-pulse">
              🔥 {indicator}
            </Badge>
          ))}
        </div>
      )}

      {/* Social Proof */}
      {socialProof.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {socialProof.map((proof, index) => (
            <Badge key={index} variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              ⭐ {proof}
            </Badge>
          ))}
        </div>
      )}

      {/* Carousel Container */}
      <div className="relative">
        {showCarousel && products.length > itemsPerView && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-2 top-1/2 transform -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-lg"
              onClick={prevSlide}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-lg"
              onClick={nextSlide}
              disabled={currentIndex >= maxIndex}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </>
        )}

        {/* Products Grid */}
        <div className="overflow-hidden">
          <div 
            className={`flex transition-transform duration-300 ease-in-out gap-4`}
            style={{ 
              transform: showCarousel ? `translateX(-${currentIndex * (100 / itemsPerView)}%)` : 'none',
              width: showCarousel ? `${(products.length / itemsPerView) * 100}%` : 'auto'
            }}
          >
            {products.map((product) => (
              <Card 
                key={product.id} 
                className={`flex-shrink-0 ${showCarousel ? `w-1/${itemsPerView}` : 'flex-1'} max-w-sm border-2 hover:border-primary transition-all duration-200 ${selectedProducts.includes(product.id) ? 'border-primary ring-2 ring-primary/20' : ''}`}
              >
                <CardContent className="p-4">
                  {/* Product Image Placeholder */}
                  <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                    {product.imageLink ? (
                      <img 
                        src={product.imageLink} 
                        alt={product.title} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
                        }}
                      />
                    ) : (
                      <div className="text-gray-400 text-sm text-center">
                        <div className="w-16 h-16 mx-auto mb-2 bg-gray-200 dark:bg-gray-600 rounded"></div>
                        No Image
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm line-clamp-2">{product.title}</h3>
                    
                    {product.brand && (
                      <Badge variant="outline" className="text-xs">{product.brand}</Badge>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        {product.discountPrice ? (
                          <div className="space-x-2">
                            <span className="text-sm font-bold text-red-600">{formatPrice(product.discountPrice)}</span>
                            <span className="text-xs text-gray-500 line-through">{formatPrice(product.price)}</span>
                          </div>
                        ) : (
                          <span className="text-sm font-bold">{formatPrice(product.price)}</span>
                        )}
                        
                        {product.availability === 'in_stock' && (
                          <Badge variant="default" className="text-xs bg-green-500">In Stock</Badge>
                        )}
                      </div>
                    </div>

                    {/* Special Features for Product Types */}
                    <div className="space-y-2">
                      {getSpecialFeatureOptions(product).slice(0, 2).map((option, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => handleQuickAction(option, product)}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {quickActions.slice(0, 2).map((action, index) => (
                        <Button
                          key={index}
                          variant={action === 'Add to Cart' ? 'default' : 'outline'}
                          size="sm"
                          className="text-xs flex items-center gap-1"
                          onClick={() => handleQuickAction(action, product)}
                        >
                          {getActionIcon(action)}
                          {action}
                        </Button>
                      ))}
                    </div>

                    {/* Comparison Checkbox */}
                    {showComparison && (
                      <div className="flex items-center space-x-2 mt-2">
                        <input
                          type="checkbox"
                          id={`compare-${product.id}`}
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => handleProductSelect(product.id)}
                          className="rounded"
                        />
                        <label htmlFor={`compare-${product.id}`} className="text-xs text-gray-600 dark:text-gray-300">
                          Compare
                        </label>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison Actions */}
      {showComparison && selectedProducts.length > 1 && (
        <div className="flex justify-center mt-4">
          <Button 
            onClick={() => onProductAction?.('compare_selected', '', selectedProducts)}
            className="flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            Compare Selected ({selectedProducts.length})
          </Button>
        </div>
      )}

      {/* Carousel Indicators */}
      {showCarousel && products.length > itemsPerView && (
        <div className="flex justify-center space-x-2 mt-4">
          {Array.from({ length: maxIndex + 1 }).map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}