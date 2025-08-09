export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  products?: any[];
  timestamp: Date;
  uiElements?: {
    showCarousel?: boolean;
    showFilters?: boolean;
    showComparison?: boolean;
    quickActions?: string[];
    urgencyIndicators?: string[];
    socialProof?: string[];
  };
  followUpQuestions?: string[];
  actions?: string[];
}

export interface ChatResponse {
  message: string;
  products?: any[];
  sessionId?: string;
  uiElements?: {
    showCarousel?: boolean;
    showFilters?: boolean;
    showComparison?: boolean;
    quickActions?: string[];
    urgencyIndicators?: string[];
    socialProof?: string[];
  };
  followUpQuestions?: string[];
  actions?: string[];
}

export interface ProductAction {
  type: 'view' | 'compare' | 'cart' | 'wishlist' | 'filter';
  productId?: string;
  filterType?: string;
  filterValue?: string;
}

export interface SmartFilter {
  type: 'price' | 'brand' | 'category' | 'feature' | 'scent' | 'watchType';
  label: string;
  options: { value: string; label: string; count?: number }[];
  selected: string[];
}

export interface ProductCarousel {
  title: string;
  products: any[];
  viewType: 'grid' | 'carousel' | 'comparison';
  filters?: SmartFilter[];
}

export interface SocialProofElement {
  type: 'popularity' | 'scarcity' | 'recent_activity' | 'reviews';
  message: string;
  data?: any;
}

export interface UrgencyIndicator {
  type: 'stock' | 'time' | 'demand' | 'price';
  level: 'low' | 'medium' | 'high';
  message: string;
  expiresAt?: Date;
}