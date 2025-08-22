import React from 'react';
import { Card, CardContent } from './card';
import { Button } from './button';
import { ChevronLeft, ChevronRight, Star, ShoppingCart } from 'lucide-react';
import type { Product } from '@shared/schema';

interface ProductCarouselProps {
  products: Product[];
  title?: string;
}

export function ProductCarousel({ products, title }: ProductCarouselProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  if (!products || products.length === 0) return null;

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % products.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + products.length) % products.length);
  };

  const formatPrice = (price: string | number | undefined) => {
    if (!price) return 'Price not available';
    const numPrice = typeof price === 'string' ? parseFloat(price.replace(/[^\d.]/g, '')) : price;
    return isNaN(numPrice) ? price : `${numPrice.toFixed(2)} AED`;
  };

  const getVisibleProducts = () => {
    if (products.length <= 3) return products;
    
    const visible = [];
    for (let i = 0; i < 3; i++) {
      visible.push(products[(currentIndex + i) % products.length]);
    }
    return visible;
  };

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">{title}</h3>
      )}
      
      <div className="relative">
        {/* Navigation Buttons */}
        {products.length > 3 && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 rounded-full w-8 h-8 p-0"
              onClick={prevSlide}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 rounded-full w-8 h-8 p-0"
              onClick={nextSlide}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </>
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-8">
          {getVisibleProducts().map((product, index) => (
            <Card key={`${product.id}-${index}`} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                {product.imageLink && (
                  <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg mb-3 overflow-hidden">
                    <img
                      src={product.imageLink}
                      alt={product.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <h4 className="font-medium text-sm line-clamp-2 text-gray-800 dark:text-gray-200">
                    {product.title}
                  </h4>
                  
                  {product.brand && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{product.brand}</p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-primary text-sm">
                        {formatPrice(product.discountPrice || product.price)}
                      </span>
                      {product.discountPrice && product.price && (
                        <span className="text-xs text-gray-500 line-through">
                          {formatPrice(product.price)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        4.5
                      </span>
                    </div>
                  </div>
                  
                  <Button size="sm" className="w-full mt-2" variant="outline">
                    <ShoppingCart className="w-3 h-3 mr-1" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Dots Indicator */}
        {products.length > 3 && (
          <div className="flex justify-center mt-4 space-x-2">
            {Array.from({ length: Math.ceil(products.length / 3) }).map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  Math.floor(currentIndex / 3) === index 
                    ? 'bg-primary' 
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
                onClick={() => setCurrentIndex(index * 3)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}