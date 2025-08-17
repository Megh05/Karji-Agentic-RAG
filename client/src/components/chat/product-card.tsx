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
        <div className="absolute top-3 left-3 px-3 py-2 rounded-xl flex items-center gap-2 text-sm font-bold z-10" style={{ backgroundColor: 'var(--hazy-teal)', color: 'var(--hazy-pearl)' }}>
          <Tag className="w-4 h-4" />
          {discount}% OFF
        </div>
      )}
      {product.imageLink && (
        <div className="product-image-area mb-4">
          <img 
            src={product.imageLink} 
            alt={product.title}
            className="w-full h-40 lg:h-48 object-cover rounded-lg transition-transform duration-300 hover:scale-105"
            onError={(e) => {
              e.currentTarget.src = `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200`;
            }}
          />
        </div>
      )}
      <div className="px-6 pb-6">
        <h3 className="product-title mb-2 leading-tight">{product.title}</h3>
        {product.description && (
          <p className="product-description mb-3 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        )}
        <div className="flex flex-col space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              {product.discountPrice ? (
                <>
                  <div className="flex items-center space-x-3">
                    <span className="product-price text-xl lg:text-2xl">{product.discountPrice}</span>
                    {discount && (
                      <Badge variant="outline" className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: 'var(--hazy-mint)', color: 'var(--hazy-charcoal)', borderColor: 'var(--hazy-sage)' }}>
                        <Percent className="w-3 h-3 mr-1" />
                        SAVE {discount}%
                      </Badge>
                    )}
                  </div>
                  {product.price && (
                    <span className="text-sm line-through font-body" style={{ color: 'var(--hazy-sage)' }}>
                      Was {product.price}
                    </span>
                  )}
                </>
              ) : (
                <span className="product-price text-xl lg:text-2xl">{product.price || 'Price not available'}</span>
              )}
            </div>
          </div>
        </div>
        <Button 
          onClick={handleViewProduct} 
          className="product-cta-btn w-full text-base py-3"
          disabled={!product.link}
        >
          View Product <ExternalLink className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
