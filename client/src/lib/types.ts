export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  products?: ProductRecommendation[];
  timestamp: Date;
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
}
