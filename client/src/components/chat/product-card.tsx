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
    <div className="product-card relative">
      {discount && (
        <div className="absolute top-4 left-4 discount-badge flex items-center gap-2 z-10">
          <Tag className="w-4 h-4" />
          {discount}% OFF
        </div>
      )}
      {product.imageLink && (
        <div className="product-image-area">
          <img 
            src={product.imageLink} 
            alt={product.title}
            className="w-full h-40 lg:h-48 object-cover"
            onError={(e) => {
              e.currentTarget.src = `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200`;
            }}
          />
        </div>
      )}
      <div className="p-4 space-y-3">
        <h3 className="product-title">{product.title}</h3>
        {product.description && (
          <p className="product-description line-clamp-2">
            {product.description}
          </p>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex flex-col space-y-1">
              {product.discountPrice ? (
                <>
                  <div className="flex items-center space-x-2">
                    <span className="product-price">{product.discountPrice}</span>
                    {discount && (
                      <Badge variant="outline" className="bg-muted text-primary border-primary text-xs font-bold px-2 py-1 rounded-full">
                        <Percent className="w-3 h-3 mr-1" />
                        {discount}%
                      </Badge>
                    )}
                  </div>
                  {product.price && (
                    <span className="text-xs text-muted-foreground line-through">
                      Was {product.price}
                    </span>
                  )}
                </>
              ) : (
                <span className="product-price">{product.price || 'Price not available'}</span>
              )}
            </div>
          </div>
        </div>
        <Button 
          onClick={handleViewProduct} 
          className="luxury-btn w-full text-sm py-2 lg:py-3"
          disabled={!product.link}
        >
          View Product <ExternalLink className="w-3 h-3 lg:w-4 lg:h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
