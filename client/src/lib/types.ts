export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  products?: ProductRecommendation[];
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

export interface ProductRecommendation {
  id: string;
  title: string;
  description?: string;
  price?: string;
  discountPrice?: string;
  imageLink?: string;
  link?: string;
  similarity?: number;
}

export interface ChatResponse {
  message: string;
  products?: ProductRecommendation[];
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
  insights?: {
    customerType: string;
    purchaseProbability: number;
    recommendedApproach: string;
  };
}
