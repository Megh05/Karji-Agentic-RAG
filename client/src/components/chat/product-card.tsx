import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Tag, Percent } from "lucide-react";
import type { ProductRecommendation } from "@/lib/types";

interface ProductCardProps {
  product: ProductRecommendation;
}

export default function ProductCard({ product }: ProductCardProps) {
  const handleViewProduct = () => {
    if (product.link) {
      window.open(product.link, '_blank');
    }
  };

  const calculateDiscount = () => {
    if (product.price && product.discountPrice) {
      const original = parseFloat(product.price.replace(/[^0-9.]/g, ''));
      const discounted = parseFloat(product.discountPrice.replace(/[^0-9.]/g, ''));
      if (original && discounted) {
        return Math.round(((original - discounted) / original) * 100);
      }
    }
    return null;
  };

  const discount = calculateDiscount();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow relative">
      {discount && (
        <div className="absolute top-2 left-2 bg-gradient-to-r from-red-500 to-red-600 text-white px-2 py-1 rounded-full flex items-center gap-1 text-xs font-bold z-10 shadow-lg">
          <Tag className="w-3 h-3" />
          {discount}% OFF
        </div>
      )}
      {product.imageLink && (
        <img 
          src={product.imageLink} 
          alt={product.title}
          className="w-full h-32 object-cover"
          onError={(e) => {
            e.currentTarget.src = `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200`;
          }}
        />
      )}
      <div className="p-4">
        <h3 className="font-semibold text-sm mb-1">{product.title}</h3>
        {product.description && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
            {product.description}
          </p>
        )}
        <div className="flex flex-col space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              {product.discountPrice ? (
                <>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-bold text-karjistore-teal">{product.discountPrice}</span>
                    {discount && (
                      <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700 text-xs">
                        <Percent className="w-3 h-3 mr-1" />
                        SAVE {discount}%
                      </Badge>
                    )}
                  </div>
                  {product.price && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 line-through">
                      Was {product.price}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-lg font-bold text-karjistore-teal">{product.price || 'Price not available'}</span>
              )}
            </div>
          </div>
        </div>
        <Button 
          onClick={handleViewProduct} 
          className="w-full text-xs py-2"
          disabled={!product.link}
        >
          View Product <ExternalLink className="w-3 h-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}
