export interface UserIntent {
  category: 'browsing' | 'buying' | 'comparing' | 'information' | 'support';
  confidence: number;
  entities: {
    products: string[];
    priceRange: { min?: number; max?: number } | null;
    brands: string[];
    categories: string[];
    features: string[];
    sentiment: 'positive' | 'negative' | 'neutral';
    urgency: 'low' | 'medium' | 'high';
  };
  actions: string[];
}

export interface ConversationContext {
  stage: 'greeting' | 'exploration' | 'consideration' | 'decision' | 'post_purchase';
  interests: string[];
  objections: string[];
  preferredCommunicationStyle: 'casual' | 'formal' | 'technical';
  purchaseReadiness: number; // 0-1 score
}

class IntentRecognitionService {
  private static instance: IntentRecognitionService;

  static getInstance(): IntentRecognitionService {
    if (!IntentRecognitionService.instance) {
      IntentRecognitionService.instance = new IntentRecognitionService();
    }
    return IntentRecognitionService.instance;
  }

  public analyzeIntent(message: string, conversationHistory: any[]): UserIntent {
    const lowercaseMessage = message.toLowerCase();
    
    // Intent classification patterns
    const buyingSignals = ['buy', 'purchase', 'order', 'add to cart', 'checkout', 'price', 'cost', 'available', 'in stock'];
    const browsingSignals = ['show me', 'what do you have', 'browse', 'look at', 'see more', 'options', 'selection'];
    const comparingSignals = ['compare', 'difference', 'versus', 'vs', 'better', 'best', 'which one', 'recommend'];
    const informationSignals = ['how', 'what', 'when', 'where', 'why', 'tell me about', 'explain', 'details'];
    const supportSignals = ['help', 'problem', 'issue', 'support', 'contact', 'return', 'refund', 'shipping'];

    // Calculate intent scores
    const buyingScore = this.calculateSignalScore(lowercaseMessage, buyingSignals);
    const browsingScore = this.calculateSignalScore(lowercaseMessage, browsingSignals);
    const comparingScore = this.calculateSignalScore(lowercaseMessage, comparingSignals);
    const informationScore = this.calculateSignalScore(lowercaseMessage, informationSignals);
    const supportScore = this.calculateSignalScore(lowercaseMessage, supportSignals);

    // Determine primary intent
    const scores = { buying: buyingScore, browsing: browsingScore, comparing: comparingScore, information: informationScore, support: supportScore };
    const primaryIntent = Object.entries(scores).reduce((a, b) => scores[a[0]] > scores[b[0]] ? a : b)[0] as UserIntent['category'];

    // Extract entities
    const entities = this.extractEntities(message);
    
    // Determine actions based on intent
    const actions = this.suggestActions(primaryIntent, entities, conversationHistory);

    return {
      category: primaryIntent,
      confidence: Math.max(...Object.values(scores)),
      entities,
      actions
    };
  }

  private calculateSignalScore(message: string, signals: string[]): number {
    let score = 0;
    signals.forEach(signal => {
      if (message.includes(signal)) {
        score += 1;
      }
    });
    return score / signals.length;
  }

  private extractEntities(message: string): UserIntent['entities'] {
    const lowercaseMessage = message.toLowerCase();
    
    // Price extraction
    const priceMatches = message.match(/(\d+)\s*(aed|dirham|dollar|\$)/gi);
    let priceRange = null;
    if (priceMatches) {
      const prices = priceMatches.map(match => parseInt(match.match(/\d+/)?.[0] || '0'));
      priceRange = { min: Math.min(...prices), max: Math.max(...prices) };
    }

    // Brand extraction (you can expand this list)
    const brands = ['chanel', 'dior', 'versace', 'armani', 'calvin klein', 'hugo boss', 'rolex', 'omega', 'seiko'];
    const detectedBrands = brands.filter(brand => lowercaseMessage.includes(brand));

    // Category extraction
    const categories = ['perfume', 'fragrance', 'watch', 'jewelry', 'skincare', 'makeup', 'fashion', 'accessories'];
    const detectedCategories = categories.filter(category => lowercaseMessage.includes(category));

    // Feature extraction
    const features = ['scent', 'wood', 'floral', 'citrus', 'oriental', 'fresh', 'leather', 'steel', 'gold', 'automatic', 'quartz', 'chronograph'];
    const detectedFeatures = features.filter(feature => lowercaseMessage.includes(feature));

    // Sentiment analysis
    const positiveWords = ['love', 'like', 'amazing', 'great', 'perfect', 'wonderful', 'excellent'];
    const negativeWords = ['hate', 'dislike', 'awful', 'terrible', 'bad', 'worst', 'horrible'];
    
    const positiveScore = positiveWords.filter(word => lowercaseMessage.includes(word)).length;
    const negativeScore = negativeWords.filter(word => lowercaseMessage.includes(word)).length;
    
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (positiveScore > negativeScore) sentiment = 'positive';
    if (negativeScore > positiveScore) sentiment = 'negative';

    // Urgency detection
    const urgencyWords = ['urgent', 'quickly', 'fast', 'asap', 'immediately', 'soon', 'today', 'now'];
    const urgencyScore = urgencyWords.filter(word => lowercaseMessage.includes(word)).length;
    let urgency: 'low' | 'medium' | 'high' = 'low';
    if (urgencyScore > 0) urgency = urgencyScore > 2 ? 'high' : 'medium';

    return {
      products: [], // Will be populated by product matching in RAG service
      priceRange,
      brands: detectedBrands,
      categories: detectedCategories,
      features: detectedFeatures,
      sentiment,
      urgency
    };
  }

  private suggestActions(intent: UserIntent['category'], entities: UserIntent['entities'], history: any[]): string[] {
    const actions: string[] = [];

    switch (intent) {
      case 'browsing':
        actions.push('show_product_carousel', 'suggest_categories', 'apply_smart_filters');
        if (entities.categories.length > 0) actions.push('show_category_products');
        break;
      case 'buying':
        actions.push('show_purchase_options', 'check_inventory', 'apply_discounts', 'create_urgency');
        if (entities.priceRange) actions.push('filter_by_price');
        break;
      case 'comparing':
        actions.push('show_comparison_table', 'highlight_differences', 'recommend_best_choice');
        break;
      case 'information':
        actions.push('provide_detailed_info', 'suggest_related_products');
        break;
      case 'support':
        actions.push('offer_assistance', 'provide_contact_info', 'resolve_issue');
        break;
    }

    // Add contextual actions based on conversation history
    if (history.length > 3) actions.push('reference_previous_interest');
    if (entities.sentiment === 'positive') actions.push('capitalize_on_enthusiasm');
    if (entities.urgency === 'high') actions.push('expedite_process');

    return actions;
  }

  public analyzeConversationContext(messages: any[]): ConversationContext {
    if (messages.length === 0) {
      return {
        stage: 'greeting',
        interests: [],
        objections: [],
        preferredCommunicationStyle: 'casual',
        purchaseReadiness: 0.1
      };
    }

    const recentMessages = messages.slice(-5);
    const allContent = recentMessages.map(m => m.content.toLowerCase()).join(' ');

    // Determine conversation stage
    let stage: ConversationContext['stage'] = 'exploration';
    if (messages.length <= 2) stage = 'greeting';
    else if (allContent.includes('buy') || allContent.includes('purchase')) stage = 'decision';
    else if (allContent.includes('compare') || allContent.includes('which')) stage = 'consideration';

    // Extract interests from conversation
    const interests = this.extractInterestsFromConversation(allContent);
    
    // Detect objections
    const objections = this.detectObjections(allContent);

    // Assess purchase readiness
    const purchaseReadiness = this.calculatePurchaseReadiness(recentMessages);

    return {
      stage,
      interests,
      objections,
      preferredCommunicationStyle: 'casual', // Can be enhanced with more analysis
      purchaseReadiness
    };
  }

  private extractInterestsFromConversation(content: string): string[] {
    const interests: string[] = [];
    const keywords = {
      'luxury': ['luxury', 'premium', 'high-end', 'expensive', 'exclusive'],
      'budget': ['cheap', 'affordable', 'budget', 'inexpensive', 'deal'],
      'fragrance': ['perfume', 'fragrance', 'scent', 'cologne'],
      'watches': ['watch', 'timepiece', 'chronograph'],
      'skincare': ['skincare', 'skin care', 'facial', 'moisturizer'],
      'jewelry': ['jewelry', 'ring', 'necklace', 'bracelet']
    };

    Object.entries(keywords).forEach(([interest, words]) => {
      if (words.some(word => content.includes(word))) {
        interests.push(interest);
      }
    });

    return interests;
  }

  private detectObjections(content: string): string[] {
    const objections: string[] = [];
    const objectionPatterns = {
      'price': ['too expensive', 'too much', 'costly', 'cheaper'],
      'quality': ['poor quality', 'not good', 'bad reviews'],
      'availability': ['out of stock', 'not available', 'sold out'],
      'trust': ['not sure', 'uncertain', 'hesitant', 'doubt']
    };

    Object.entries(objectionPatterns).forEach(([objection, patterns]) => {
      if (patterns.some(pattern => content.includes(pattern))) {
        objections.push(objection);
      }
    });

    return objections;
  }

  private calculatePurchaseReadiness(messages: any[]): number {
    let score = 0.1; // Base score
    const content = messages.map(m => m.content.toLowerCase()).join(' ');

    // Positive indicators
    if (content.includes('buy') || content.includes('purchase')) score += 0.3;
    if (content.includes('price') || content.includes('cost')) score += 0.2;
    if (content.includes('available') || content.includes('stock')) score += 0.2;
    if (content.includes('love') || content.includes('perfect')) score += 0.2;

    // Negative indicators
    if (content.includes('expensive') || content.includes('too much')) score -= 0.1;
    if (content.includes('think about') || content.includes('maybe')) score -= 0.1;

    return Math.min(1, Math.max(0, score));
  }
}

export const intentRecognitionService = IntentRecognitionService.getInstance();