export interface UserIntent {
  category: 'browsing' | 'buying' | 'comparing' | 'information' | 'support' | 'brandListing';
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
  // Removed spelling correction fields since AI will handle this
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
    // AI model will handle spelling correction, so we work with the original message
    const lowercaseMessage = message.toLowerCase();
    
    // Enhanced intent classification patterns
    const buyingSignals = ['buy', 'purchase', 'order', 'add to cart', 'checkout', 'available', 'in stock', 'yes i want to buy', 'ready to purchase', 'want this', 'yes, i want to buy this'];
    const browsingSignals = ['show me products', 'what products do you have', 'browse products', 'see your selection', 'show me fragrances', 'show me perfumes', 'open to any', 'open to anything', 'flexible', 'show me', 'what do you have', 'do you have', 'brands do you have', 'which brands'];
    const brandListingSignals = ['which brands', 'what brands', 'brands do you have', 'what brands do you have', 'list brands', 'show brands', 'available brands', 'luxury brands', 'premium brands', 'designer brands'];
    const comparingSignals = ['compare these', 'difference between these', 'versus', 'vs', 'which of these is better', 'deciding between these products', 'compare between', 'show me comparison', 'side by side', 'compare', 'comparison'];
    const informationSignals = ['how', 'what', 'when', 'where', 'why', 'tell me about', 'explain', 'details', 'shipping', 'returns', 'price', 'cost'];
    const supportSignals = ['help me choose', 'help me decide', 'help me narrow down', 'help me find', 'need help', 'i need assistance', 'can you help'];
    const satisfactionSignals = ['perfect', 'these look great', 'exactly what i need', 'love these', 'these are good', 'satisfied', 'happy with these'];
    const preferencesSignals = ['for myself', 'for someone special', 'budget-friendly', 'premium quality', 'floral', 'woody', 'musky', 'everyday', 'special occasion'];
    
    // Check if user is confirming a purchase intent from previous products shown
    // Check if this is a follow-up query that needs clarification
    const needsClarification = this.needsClarification(message, conversationHistory);
    if (needsClarification) {
      return {
        category: 'support' as UserIntent['category'],
        confidence: 0.9,
        entities: this.extractEntities(message),
        actions: ['ask_clarifying_questions', 'gather_missing_context']
      };
    }

    const purchaseConfirmationSignals = ['yes, i want to buy this', 'yes i want to buy', 'i want to purchase', 'proceed with purchase'];
    const hasProductsInHistory = conversationHistory.some((msg: any) => 
      msg.type === 'assistant' && (msg.content?.includes('AED') || msg.content?.includes('Price:') || msg.content?.includes('product')));
    const isPurchaseConfirmation = this.calculateSignalScore(lowercaseMessage, purchaseConfirmationSignals) > 0.5;

    // Calculate intent scores including new patterns
    const buyingScore = this.calculateSignalScore(lowercaseMessage, buyingSignals);
    const browsingScore = this.calculateSignalScore(lowercaseMessage, browsingSignals);
    const brandListingScore = this.calculateSignalScore(lowercaseMessage, brandListingSignals);
    const comparingScore = this.calculateSignalScore(lowercaseMessage, comparingSignals);
    const informationScore = this.calculateSignalScore(lowercaseMessage, informationSignals);
    const supportScore = this.calculateSignalScore(lowercaseMessage, supportSignals);
    const satisfactionScore = this.calculateSignalScore(lowercaseMessage, satisfactionSignals);
    const preferencesScore = this.calculateSignalScore(lowercaseMessage, preferencesSignals);

    // Priority 1: Purchase confirmation after products were shown
    if (isPurchaseConfirmation && hasProductsInHistory) {
      return {
        category: 'buying' as UserIntent['category'],
        confidence: 0.95,
        entities: this.extractEntities(message),
        actions: ['confirm_purchase_intent', 'guide_to_checkout', 'provide_purchase_assistance']
      };
    }

    // Priority 2: If satisfaction signals are strong, prioritize buying intent
    if (satisfactionScore > 0.3) {
      return {
        category: 'buying' as UserIntent['category'],
        confidence: Math.max(0.8, satisfactionScore),
        entities: this.extractEntities(message),
        actions: ['guide_to_purchase', 'check_inventory', 'provide_purchase_assistance']
      };
    }

    // Determine primary intent
    const scores = { buying: buyingScore, browsing: browsingScore, brandListing: brandListingScore, comparing: comparingScore, information: informationScore, support: supportScore };
    
    // Priority: Brand listing should take precedence when detected
    let primaryIntent: UserIntent['category'];
    if (brandListingScore > 0.3) {
      primaryIntent = 'brandListing';
    } else {
      primaryIntent = Object.entries(scores).reduce((a, b) => scores[a[0] as keyof typeof scores] > scores[b[0] as keyof typeof scores] ? a : b)[0] as UserIntent['category'];
    }

    // Extract entities from original message
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

    // Enhanced brand extraction
    const brands = ['chanel', 'dior', 'versace', 'armani', 'calvin klein', 'hugo boss', 'rolex', 'omega', 'seiko', 'aigner', 'fabian', 'lencia', 'police', 'tom ford', 'roberto cavalli'];
    const detectedBrands = brands.filter(brand => lowercaseMessage.includes(brand));
    
    // Enhanced brand detection for broader brand queries
    if (lowercaseMessage.includes('brand') || lowercaseMessage.includes('brands')) {
      // If user asks about brands in general, detect any brand mentioned
      const brandPatterns = ['do you have', 'show me', 'what brands', 'which brands', 'brands do you have'];
      const isBrandQuery = brandPatterns.some(pattern => lowercaseMessage.includes(pattern));
      if (isBrandQuery) {
        // Extract brand names from the message more intelligently
        const brandMatches = brands.filter(brand => lowercaseMessage.includes(brand));
        if (brandMatches.length > 0) {
          detectedBrands.push(...brandMatches);
        }
      }
    }

    // Enhanced category extraction
    const categoryKeywords = {
      'perfume': ['perfume', 'fragrance', 'cologne', 'scent', 'aroma'],
      'watch': ['watch', 'watches', 'timepiece', 'chronograph', 'time', 'clock'],
      'jewelry': ['jewelry', 'ring', 'necklace', 'bracelet', 'earrings', 'pendant'],
      'accessories': ['accessories', 'accessory', 'belt', 'wallet', 'cufflinks', 'tie', 'scarf'],
      'skincare': ['skincare', 'skin care', 'facial', 'moisturizer', 'cream', 'lotion', 'serum'],
      'makeup': ['makeup', 'make up', 'cosmetics', 'lipstick', 'mascara', 'foundation'],
      'fashion': ['fashion', 'clothing', 'dress', 'shirt', 'pants', 'shoes', 'bags']
    };
    
    const detectedCategories: string[] = [];
    
    // Check each category
    Object.entries(categoryKeywords).forEach(([category, keywords]) => {
      const hasMatch = keywords.some(keyword => lowercaseMessage.includes(keyword));
      if (hasMatch) {
        detectedCategories.push(category);
      }
    });

    // Enhanced feature extraction
    const featureKeywords = {
      'scent': ['scent', 'smell', 'aroma', 'fragrance'],
      'wood': ['wood', 'woody', 'wooden', 'oak', 'cedar'],
      'floral': ['floral', 'flower', 'rose', 'jasmine', 'lily'],
      'citrus': ['citrus', 'lemon', 'orange', 'lime', 'grapefruit'],
      'oriental': ['oriental', 'spicy', 'warm', 'exotic'],
      'fresh': ['fresh', 'clean', 'crisp', 'light'],
      'leather': ['leather', 'leathery', 'suede'],
      'steel': ['steel', 'stainless', 'metal', 'silver'],
      'gold': ['gold', 'golden', 'yellow'],
      'automatic': ['automatic', 'auto', 'self-winding'],
      'quartz': ['quartz', 'battery'],
      'chronograph': ['chronograph', 'chrono', 'stopwatch']
    };
    
    const detectedFeatures: string[] = [];
    
    Object.entries(featureKeywords).forEach(([feature, keywords]) => {
      const hasMatch = keywords.some(keyword => lowercaseMessage.includes(keyword));
      if (hasMatch) {
        detectedFeatures.push(feature);
      }
    });

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

  /**
   * Check if a follow-up query needs clarification due to missing context
   */
  private needsClarification(message: string, conversationHistory: any[]): boolean {
    const lowercaseMessage = message.toLowerCase();
    
    // Check if this is a follow-up query that lacks specific context
    const followUpPatterns = [
      'show me more',
      'show me few more',
      'show me some more',
      'i want more',
      'more options',
      'more choices',
      'another one',
      'different one',
      'something else',
      'other options',
      'other choices',
      'what else',
      'anything else'
    ];
    
    const isFollowUpQuery = followUpPatterns.some(pattern => lowercaseMessage.includes(pattern));
    
    if (!isFollowUpQuery) {
      return false;
    }
    
    // Check if we have enough context from previous messages
    if (conversationHistory.length === 0) {
      return true; // No history, definitely needs clarification
    }
    
    // Look for the last assistant message that showed products
    const lastProductMessage = conversationHistory
      .slice()
      .reverse()
      .find((msg: any) => 
        msg.type === 'assistant' && 
        (msg.content?.includes('AED') || msg.content?.includes('Price:') || msg.content?.includes('product'))
      );
    
    if (!lastProductMessage) {
      return true; // No product context found
    }
    
    // Extract context from the last product message
    const lastContent = lastProductMessage.content.toLowerCase();
    
    // Check if we can identify what category/products were shown
    const hasCategoryContext = [
      'watch', 'watches', 'timepiece',
      'perfume', 'fragrance', 'cologne',
      'jewelry', 'bracelet', 'necklace',
      'accessories', 'wallet', 'belt'
    ].some(category => lastContent.includes(category));
    
    const hasBrandContext = [
      'police', 'roberto cavalli', 'aigner', 'cerruti',
      'chanel', 'dior', 'versace', 'armani'
    ].some(brand => lastContent.includes(brand));
    
    // If we have clear context, no clarification needed
    if (hasCategoryContext || hasBrandContext) {
      return false;
    }
    
    // If it's a generic follow-up without clear context, needs clarification
    return true;
  }

  private suggestActions(intent: UserIntent['category'], entities: UserIntent['entities'], history: any[]): string[] {
    const actions: string[] = [];

    switch (intent) {
      case 'browsing':
        // Only show products if user has specific preferences or explicitly requests to see products
        if (entities.categories.length > 0 || entities.brands.length > 0 || entities.priceRange) {
          actions.push('show_product_carousel', 'show_category_products');
        } else {
          actions.push('ask_preferences', 'suggest_categories', 'gather_requirements');
        }
        break;
      case 'buying':
        actions.push('show_purchase_options', 'check_inventory', 'apply_discounts', 'create_urgency');
        if (entities.priceRange) actions.push('filter_by_price');
        break;
      case 'comparing':
        // Only show comparison if there are specific products to compare
        const hasProductsInHistory = history.some((msg: any) => msg.type === 'assistant' && msg.content?.includes('AED'));
        if (hasProductsInHistory) {
          actions.push('show_comparison_table', 'highlight_differences', 'recommend_best_choice');
        } else {
          actions.push('ask_comparison_criteria', 'gather_preferences_for_comparison');
        }
        break;
      case 'information':
        actions.push('provide_detailed_info');
        // Only suggest products if specific info was requested about products
        if (entities.products.length > 0) actions.push('suggest_related_products');
        break;
      case 'support':
        actions.push('ask_clarifying_questions', 'gather_preferences', 'provide_guidance');
        // Don't immediately show products for support requests
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