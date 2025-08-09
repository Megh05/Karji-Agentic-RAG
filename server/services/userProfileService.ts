export interface UserProfile {
  sessionId: string;
  demographics: {
    estimatedAge?: string;
    gender?: string;
    location?: string;
  };
  preferences: {
    categories: { [key: string]: number }; // Category -> interest score (0-1)
    brands: { [key: string]: number };
    priceRanges: { [key: string]: number }; // "0-100", "100-300", etc.
    features: { [key: string]: number }; // "luxury", "budget", "organic", etc.
    colors: { [key: string]: number };
    scents: { [key: string]: number }; // For perfumes
    watchTypes: { [key: string]: number }; // For watches
  };
  behaviorPatterns: {
    browsingStyle: 'quick_decision' | 'research_heavy' | 'price_conscious' | 'impulse_buyer';
    communicationStyle: 'formal' | 'casual' | 'technical';
    sessionDuration: number;
    messageFrequency: number;
    purchaseHistory: any[];
    abandonmentPatterns: string[];
  };
  emotionalProfile: {
    currentMood: 'excited' | 'skeptical' | 'curious' | 'frustrated' | 'neutral';
    enthusiasmLevel: number; // 0-1
    trustLevel: number; // 0-1
    urgencyLevel: number; // 0-1
  };
  contextualState: {
    currentNeed: string;
    decisionStage: 'awareness' | 'consideration' | 'decision' | 'retention';
    objections: string[];
    motivations: string[];
  };
  learningMetrics: {
    clickedProducts: string[];
    ignoredSuggestions: string[];
    positiveResponses: string[];
    negativeResponses: string[];
    conversionTriggers: string[];
  };
  lastUpdated: Date;
}

class UserProfileService {
  private static instance: UserProfileService;
  private profiles: Map<string, UserProfile> = new Map();

  static getInstance(): UserProfileService {
    if (!UserProfileService.instance) {
      UserProfileService.instance = new UserProfileService();
    }
    return UserProfileService.instance;
  }

  public getOrCreateProfile(sessionId: string): UserProfile {
    if (!this.profiles.has(sessionId)) {
      this.profiles.set(sessionId, this.createNewProfile(sessionId));
    }
    return this.profiles.get(sessionId)!;
  }

  private createNewProfile(sessionId: string): UserProfile {
    return {
      sessionId,
      demographics: {},
      preferences: {
        categories: {},
        brands: {},
        priceRanges: {},
        features: {},
        colors: {},
        scents: {},
        watchTypes: {}
      },
      behaviorPatterns: {
        browsingStyle: 'research_heavy',
        communicationStyle: 'casual',
        sessionDuration: 0,
        messageFrequency: 0,
        purchaseHistory: [],
        abandonmentPatterns: []
      },
      emotionalProfile: {
        currentMood: 'neutral',
        enthusiasmLevel: 0.5,
        trustLevel: 0.5,
        urgencyLevel: 0.1
      },
      contextualState: {
        currentNeed: '',
        decisionStage: 'awareness',
        objections: [],
        motivations: []
      },
      learningMetrics: {
        clickedProducts: [],
        ignoredSuggestions: [],
        positiveResponses: [],
        negativeResponses: [],
        conversionTriggers: []
      },
      lastUpdated: new Date()
    };
  }

  public updateProfileFromMessage(sessionId: string, message: string, intent: any, response?: any): void {
    const profile = this.getOrCreateProfile(sessionId);
    
    // Update preferences based on message content
    this.updatePreferences(profile, message, intent);
    
    // Update emotional profile
    this.updateEmotionalProfile(profile, message, intent);
    
    // Update behavioral patterns
    this.updateBehaviorPatterns(profile, message);
    
    // Update contextual state
    this.updateContextualState(profile, message, intent);
    
    // Learn from interactions
    if (response) {
      this.updateLearningMetrics(profile, message, response);
    }
    
    profile.lastUpdated = new Date();
  }

  private updatePreferences(profile: UserProfile, message: string, intent: any): void {
    const lowercaseMessage = message.toLowerCase();
    
    // Update category preferences
    const categories = ['perfume', 'fragrance', 'watch', 'jewelry', 'skincare', 'makeup', 'fashion'];
    categories.forEach(category => {
      if (lowercaseMessage.includes(category)) {
        profile.preferences.categories[category] = (profile.preferences.categories[category] || 0) + 0.1;
      }
    });

    // Update brand preferences
    if (intent.entities?.brands) {
      intent.entities.brands.forEach((brand: string) => {
        profile.preferences.brands[brand] = (profile.preferences.brands[brand] || 0) + 0.2;
      });
    }

    // Update price range preferences
    if (intent.entities?.priceRange) {
      const { min, max } = intent.entities.priceRange;
      const range = this.categorizePrice(min, max);
      profile.preferences.priceRanges[range] = (profile.preferences.priceRanges[range] || 0) + 0.15;
    }

    // Update feature preferences
    const luxuryKeywords = ['luxury', 'premium', 'high-end', 'exclusive'];
    const budgetKeywords = ['cheap', 'affordable', 'budget', 'deal'];
    
    if (luxuryKeywords.some(keyword => lowercaseMessage.includes(keyword))) {
      profile.preferences.features['luxury'] = (profile.preferences.features['luxury'] || 0) + 0.2;
    }
    
    if (budgetKeywords.some(keyword => lowercaseMessage.includes(keyword))) {
      profile.preferences.features['budget'] = (profile.preferences.features['budget'] || 0) + 0.2;
    }

    // Update scent preferences for perfumes
    const scents = ['floral', 'woody', 'citrus', 'oriental', 'fresh', 'spicy', 'fruity'];
    scents.forEach(scent => {
      if (lowercaseMessage.includes(scent)) {
        profile.preferences.scents[scent] = (profile.preferences.scents[scent] || 0) + 0.15;
      }
    });

    // Update watch type preferences
    const watchTypes = ['automatic', 'quartz', 'chronograph', 'diving', 'dress', 'sport'];
    watchTypes.forEach(type => {
      if (lowercaseMessage.includes(type)) {
        profile.preferences.watchTypes[type] = (profile.preferences.watchTypes[type] || 0) + 0.15;
      }
    });
  }

  private categorizePrice(min?: number, max?: number): string {
    if (!min && !max) return 'any';
    const price = max || min || 0;
    
    if (price <= 100) return '0-100';
    if (price <= 300) return '100-300';
    if (price <= 500) return '300-500';
    if (price <= 1000) return '500-1000';
    return '1000+';
  }

  private updateEmotionalProfile(profile: UserProfile, message: string, intent: any): void {
    const sentiment = intent.entities?.sentiment || 'neutral';
    const urgency = intent.entities?.urgency || 'low';
    
    // Update enthusiasm based on sentiment
    if (sentiment === 'positive') {
      profile.emotionalProfile.enthusiasmLevel = Math.min(1, profile.emotionalProfile.enthusiasmLevel + 0.2);
      profile.emotionalProfile.currentMood = 'excited';
    } else if (sentiment === 'negative') {
      profile.emotionalProfile.enthusiasmLevel = Math.max(0, profile.emotionalProfile.enthusiasmLevel - 0.1);
      profile.emotionalProfile.currentMood = 'frustrated';
    }

    // Update urgency
    const urgencyScores = { low: 0.1, medium: 0.5, high: 0.9 };
    profile.emotionalProfile.urgencyLevel = urgencyScores[urgency];

    // Update trust level based on interaction patterns
    if (message.toLowerCase().includes('thank') || message.toLowerCase().includes('helpful')) {
      profile.emotionalProfile.trustLevel = Math.min(1, profile.emotionalProfile.trustLevel + 0.1);
    }
  }

  private updateBehaviorPatterns(profile: UserProfile, message: string): void {
    // Determine browsing style based on message patterns
    const quickDecisionKeywords = ['buy now', 'immediate', 'quick', 'fast'];
    const researchKeywords = ['compare', 'details', 'information', 'research', 'reviews'];
    const priceKeywords = ['cheap', 'price', 'deal', 'discount', 'cost'];

    if (quickDecisionKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
      profile.behaviorPatterns.browsingStyle = 'quick_decision';
    } else if (researchKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
      profile.behaviorPatterns.browsingStyle = 'research_heavy';
    } else if (priceKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
      profile.behaviorPatterns.browsingStyle = 'price_conscious';
    }

    // Update message frequency
    profile.behaviorPatterns.messageFrequency++;
  }

  private updateContextualState(profile: UserProfile, message: string, intent: any): void {
    // Update current need
    if (intent.entities?.categories?.length > 0) {
      profile.contextualState.currentNeed = intent.entities.categories[0];
    }

    // Update decision stage based on intent
    switch (intent.category) {
      case 'browsing':
        profile.contextualState.decisionStage = 'awareness';
        break;
      case 'comparing':
        profile.contextualState.decisionStage = 'consideration';
        break;
      case 'buying':
        profile.contextualState.decisionStage = 'decision';
        break;
    }

    // Detect objections
    const objectionKeywords = {
      'price': ['expensive', 'costly', 'too much'],
      'quality': ['cheap', 'poor quality', 'not good'],
      'trust': ['not sure', 'doubt', 'uncertain'],
      'availability': ['out of stock', 'not available']
    };

    Object.entries(objectionKeywords).forEach(([objection, keywords]) => {
      if (keywords.some(keyword => message.toLowerCase().includes(keyword))) {
        if (!profile.contextualState.objections.includes(objection)) {
          profile.contextualState.objections.push(objection);
        }
      }
    });

    // Detect motivations
    const motivationKeywords = {
      'gift': ['gift', 'present', 'birthday', 'anniversary'],
      'personal': ['myself', 'personal', 'for me'],
      'occasion': ['party', 'event', 'special occasion', 'wedding'],
      'upgrade': ['better', 'upgrade', 'replace', 'new']
    };

    Object.entries(motivationKeywords).forEach(([motivation, keywords]) => {
      if (keywords.some(keyword => message.toLowerCase().includes(keyword))) {
        if (!profile.contextualState.motivations.includes(motivation)) {
          profile.contextualState.motivations.push(motivation);
        }
      }
    });
  }

  private updateLearningMetrics(profile: UserProfile, message: string, response: any): void {
    // Track positive responses
    const positiveIndicators = ['thank', 'great', 'perfect', 'love', 'excellent'];
    if (positiveIndicators.some(indicator => message.toLowerCase().includes(indicator))) {
      profile.learningMetrics.positiveResponses.push(message);
    }

    // Track negative responses
    const negativeIndicators = ['no', 'not interested', 'bad', 'terrible', 'awful'];
    if (negativeIndicators.some(indicator => message.toLowerCase().includes(indicator))) {
      profile.learningMetrics.negativeResponses.push(message);
    }
  }

  public getPersonalizedRecommendations(sessionId: string): any {
    const profile = this.getOrCreateProfile(sessionId);
    
    return {
      recommendedCategories: this.getTopPreferences(profile.preferences.categories),
      recommendedBrands: this.getTopPreferences(profile.preferences.brands),
      recommendedPriceRange: this.getTopPreferences(profile.preferences.priceRanges),
      recommendedFeatures: this.getTopPreferences(profile.preferences.features),
      communicationTone: this.getRecommendedTone(profile),
      urgencyLevel: profile.emotionalProfile.urgencyLevel,
      trustLevel: profile.emotionalProfile.trustLevel
    };
  }

  private getTopPreferences(preferences: { [key: string]: number }): string[] {
    return Object.entries(preferences)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([key]) => key);
  }

  private getRecommendedTone(profile: UserProfile): string {
    if (profile.emotionalProfile.enthusiasmLevel > 0.7) return 'enthusiastic';
    if (profile.emotionalProfile.trustLevel < 0.4) return 'reassuring';
    if (profile.behaviorPatterns.browsingStyle === 'research_heavy') return 'detailed';
    if (profile.behaviorPatterns.browsingStyle === 'quick_decision') return 'concise';
    return 'balanced';
  }

  public trackProductInteraction(sessionId: string, productId: string, action: 'clicked' | 'ignored' | 'purchased'): void {
    const profile = this.getOrCreateProfile(sessionId);
    
    switch (action) {
      case 'clicked':
        profile.learningMetrics.clickedProducts.push(productId);
        break;
      case 'ignored':
        profile.learningMetrics.ignoredSuggestions.push(productId);
        break;
      case 'purchased':
        profile.behaviorPatterns.purchaseHistory.push({ productId, date: new Date() });
        break;
    }
  }

  public getProfileInsights(sessionId: string): any {
    const profile = this.getOrCreateProfile(sessionId);
    
    return {
      customerType: this.classifyCustomerType(profile),
      purchaseProbability: this.calculatePurchaseProbability(profile),
      recommendedApproach: this.getRecommendedApproach(profile),
      keyTriggers: this.identifyKeyTriggers(profile),
      potentialObjections: profile.contextualState.objections,
      motivations: profile.contextualState.motivations
    };
  }

  private classifyCustomerType(profile: UserProfile): string {
    const { browsingStyle, communicationStyle } = profile.behaviorPatterns;
    const { enthusiasmLevel, trustLevel } = profile.emotionalProfile;
    
    if (browsingStyle === 'quick_decision' && enthusiasmLevel > 0.7) return 'impulse_buyer';
    if (browsingStyle === 'research_heavy' && trustLevel > 0.8) return 'analytical_buyer';
    if (browsingStyle === 'price_conscious') return 'bargain_hunter';
    if (enthusiasmLevel > 0.8 && trustLevel > 0.7) return 'loyal_customer';
    return 'casual_browser';
  }

  private calculatePurchaseProbability(profile: UserProfile): number {
    let score = 0.1; // Base probability
    
    // Positive factors
    score += profile.emotionalProfile.enthusiasmLevel * 0.3;
    score += profile.emotionalProfile.trustLevel * 0.2;
    score += profile.emotionalProfile.urgencyLevel * 0.2;
    
    if (profile.behaviorPatterns.browsingStyle === 'quick_decision') score += 0.2;
    if (profile.contextualState.decisionStage === 'decision') score += 0.3;
    
    // Negative factors
    score -= profile.contextualState.objections.length * 0.1;
    if (profile.learningMetrics.ignoredSuggestions.length > 3) score -= 0.2;
    
    return Math.min(1, Math.max(0, score));
  }

  private getRecommendedApproach(profile: UserProfile): string {
    const customerType = this.classifyCustomerType(profile);
    
    switch (customerType) {
      case 'impulse_buyer': return 'create_urgency_and_excitement';
      case 'analytical_buyer': return 'provide_detailed_comparisons';
      case 'bargain_hunter': return 'emphasize_deals_and_savings';
      case 'loyal_customer': return 'offer_exclusive_recommendations';
      default: return 'build_trust_and_explore_needs';
    }
  }

  private identifyKeyTriggers(profile: UserProfile): string[] {
    const triggers: string[] = [];
    
    if (profile.preferences.features['luxury']) triggers.push('exclusivity');
    if (profile.preferences.features['budget']) triggers.push('value_for_money');
    if (profile.emotionalProfile.urgencyLevel > 0.7) triggers.push('limited_time_offers');
    if (profile.contextualState.motivations.includes('gift')) triggers.push('gift_wrapping');
    if (profile.behaviorPatterns.browsingStyle === 'research_heavy') triggers.push('detailed_specifications');
    
    return triggers;
  }
}

export const userProfileService = UserProfileService.getInstance();