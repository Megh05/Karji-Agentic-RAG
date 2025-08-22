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
    <div className="product-card relative max-w-xs">
      {discount && (
        <div className="absolute top-2 left-2 discount-badge flex items-center gap-1 z-10 text-xs px-2 py-1">
          <Tag className="w-3 h-3" />
          {discount}% OFF
        </div>
      )}
      {product.imageLink && (
        <div className="product-image-area">
          <img 
            src={product.imageLink} 
            alt={product.title}
            className="w-full h-32 object-cover"
            onError={(e) => {
              e.currentTarget.src = `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200`;
            }}
          />
        </div>
      )}
      <div className="p-3 space-y-2">
        <h3 className="product-title text-sm font-semibold line-clamp-2">{product.title}</h3>
        <div className="space-y-1">
          <div className="flex flex-col space-y-1">
            {product.discountPrice ? (
              <>
                <div className="flex items-center space-x-1">
                  <span className="product-price text-sm font-bold">{product.discountPrice}</span>
                  {discount && (
                    <Badge variant="outline" className="bg-muted text-primary border-primary text-xs font-bold px-1 py-0 rounded-full">
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
              <span className="product-price text-sm font-bold">{product.price || 'Price not available'}</span>
            )}
          </div>
        </div>
        <Button 
          onClick={handleViewProduct} 
          className="luxury-btn w-full text-xs py-2"
          disabled={!product.link}
        >
          <span>View <ExternalLink className="w-3 h-3 ml-1" /></span>
        </Button>
      </div>
    </div>
  );
}
