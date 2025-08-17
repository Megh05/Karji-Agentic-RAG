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
    <div className="product-card-3d relative cardboard-responsive">
      {discount && (
        <div className="absolute top-3 left-3 gold-button px-3 py-2 rounded-2xl flex items-center gap-2 text-sm font-bold z-10">
          <Tag className="w-4 h-4" />
          {discount}% OFF
        </div>
      )}
      {product.imageLink && (
        <div className="relative overflow-hidden">
          <img 
            src={product.imageLink} 
            alt={product.title}
            className="w-full h-40 lg:h-48 object-cover transition-transform duration-300 hover:scale-105"
            onError={(e) => {
              e.currentTarget.src = `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200`;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
        </div>
      )}
      <div className="cardboard-responsive-padding">
        <h3 className="font-bold cardboard-responsive-text luxury-text mb-2 leading-tight">{product.title}</h3>
        {product.description && (
          <p className="text-sm text-muted-foreground cardboard-text mb-3 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        )}
        <div className="flex flex-col space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              {product.discountPrice ? (
                <>
                  <div className="flex items-center space-x-3">
                    <span className="text-xl lg:text-2xl font-bold luxury-text">{product.discountPrice}</span>
                    {discount && (
                      <Badge variant="outline" className="cardboard-light bg-secondary text-primary border-primary text-xs font-bold px-2 py-1 rounded-full">
                        <Percent className="w-3 h-3 mr-1" />
                        SAVE {discount}%
                      </Badge>
                    )}
                  </div>
                  {product.price && (
                    <span className="text-sm text-muted-foreground line-through cardboard-text">
                      Was {product.price}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xl lg:text-2xl font-bold luxury-text">{product.price || 'Price not available'}</span>
              )}
            </div>
          </div>
        </div>
        <Button 
          onClick={handleViewProduct} 
          className="btn-gold w-full text-base py-3 rounded-2xl font-bold icon-3d"
          disabled={!product.link}
        >
          View Product <ExternalLink className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
