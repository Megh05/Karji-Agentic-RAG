import { intentRecognitionService } from './intentRecognition.js';
import { userProfileService } from './userProfileService.js';
import type { Product } from '@shared/schema';

export interface SmartResponse {
  message: string;
  products?: Product[];
  actions: string[];
  followUpQuestions: string[];
  uiElements: {
    showCarousel: boolean;
    showFilters: boolean;
    showComparison: boolean;
    quickActions: string[];
    urgencyIndicators: string[];
    socialProof: string[];
  };
  personalizedTone: string;
  nextBestActions: string[];
}

export interface ContextualFollowUp {
  trigger: string;
  message: string;
  timing: number; // seconds to wait before showing
  condition: (profile: any, conversation: any[]) => boolean;
}

class SmartResponseService {
  private static instance: SmartResponseService;

  static getInstance(): SmartResponseService {
    if (!SmartResponseService.instance) {
      SmartResponseService.instance = new SmartResponseService();
    }
    return SmartResponseService.instance;
  }

  public generateSmartResponse(
    userMessage: string,
    sessionId: string,
    conversationHistory: any[],
    ragContext: any,
    aiResponse: string
  ): SmartResponse {
    // Analyze user intent and update profile
    const intent = intentRecognitionService.analyzeIntent(userMessage, conversationHistory);
    userProfileService.updateProfileFromMessage(sessionId, userMessage, intent);
    
    // Get user profile insights
    const profile = userProfileService.getOrCreateProfile(sessionId);
    const insights = userProfileService.getProfileInsights(sessionId);
    const recommendations = userProfileService.getPersonalizedRecommendations(sessionId);

    // Enhance AI response with intelligence
    const enhancedMessage = this.enhanceResponseWithIntelligence(
      aiResponse,
      intent,
      profile,
      insights,
      conversationHistory
    );

    // Generate smart product recommendations
    const smartProducts = this.selectSmartProducts(ragContext.products, profile, intent);

    // Generate contextual actions
    const actions = this.generateContextualActions(intent, profile, insights);

    // Generate follow-up questions
    const followUpQuestions = this.generateSmartFollowUps(intent, profile, conversationHistory);

    // Generate UI elements
    const uiElements = this.generateUIElements(intent, profile, smartProducts);

    // Determine personalized tone
    const personalizedTone = recommendations.communicationTone;

    // Generate next best actions
    const nextBestActions = this.generateNextBestActions(intent, profile, insights);

    return {
      message: enhancedMessage,
      products: smartProducts,
      actions,
      followUpQuestions,
      uiElements,
      personalizedTone,
      nextBestActions
    };
  }

  private enhanceResponseWithIntelligence(
    baseResponse: string,
    intent: any,
    profile: any,
    insights: any,
    conversationHistory: any[]
  ): string {
    // Keep responses concise and conversational
    let enhanced = baseResponse;

    // Limit response length to be more concise
    if (enhanced.length > 150) {
      enhanced = enhanced.substring(0, 150).trim();
      // Ensure we end at a complete sentence
      const lastPeriod = enhanced.lastIndexOf('.');
      if (lastPeriod > 50) {
        enhanced = enhanced.substring(0, lastPeriod + 1);
      }
    }

    // Add brief personalization only if needed
    if (profile.preferences.categories && Object.keys(profile.preferences.categories).length > 0) {
      const topCategory = Object.entries(profile.preferences.categories)
        .sort(([,a], [,b]) => (b as number) - (a as number))[0][0];
      
      if (conversationHistory.length > 3 && !enhanced.includes(topCategory)) {
        enhanced = `Perfect for ${topCategory} enthusiasts! ` + enhanced;
      }
    }

    return enhanced;
  }

  private selectSmartProducts(products: Product[], profile: any, intent: any): Product[] {
    if (!products || products.length === 0) return [];

    let scoredProducts = products.map(product => ({
      ...product,
      score: this.calculateProductScore(product, profile, intent)
    }));

    // Sort by score and return top products
    scoredProducts.sort((a, b) => b.score - a.score);
    
    // Limit based on user browsing style
    const limit = profile.behaviorPatterns.browsingStyle === 'quick_decision' ? 3 : 
                  profile.behaviorPatterns.browsingStyle === 'research_heavy' ? 4 : 4;
    
    return scoredProducts.slice(0, limit);
  }

  private calculateProductScore(product: Product, profile: any, intent: any): number {
    let score = 0;

    // Category preference matching
    Object.entries(profile.preferences.categories || {}).forEach(([category, weight]) => {
      if (product.title?.toLowerCase().includes(category.toLowerCase()) || 
          product.description?.toLowerCase().includes(category.toLowerCase())) {
        score += (weight as number) * 10;
      }
    });

    // Brand preference matching
    Object.entries(profile.preferences.brands || {}).forEach(([brand, weight]) => {
      if (product.brand?.toLowerCase().includes(brand.toLowerCase())) {
        score += (weight as number) * 8;
      }
    });

    // Price range preference
    if (product.price && profile.preferences.priceRanges) {
      const productPrice = parseFloat(product.price.replace(/[^\d.]/g, ''));
      const preferredRange = this.getPreferredPriceRange(profile.preferences.priceRanges);
      if (this.isPriceInRange(productPrice, preferredRange)) {
        score += 5;
      }
    }

    // Feature matching (luxury vs budget)
    if (profile.preferences.features?.luxury && 
        (product.title?.toLowerCase().includes('luxury') || 
         product.title?.toLowerCase().includes('premium'))) {
      score += 6;
    }

    if (profile.preferences.features?.budget && 
        (product.discountPrice || product.title?.toLowerCase().includes('deal'))) {
      score += 6;
    }

    // Intent-based scoring
    if (intent.category === 'buying' && product.availability === 'in_stock') {
      score += 8;
    }

    // Recency and popularity (if available in product data)
    if (product.additionalFields?.popularity) {
      score += product.additionalFields.popularity * 2;
    }

    return score;
  }

  private getPreferredPriceRange(priceRanges: { [key: string]: number }): string {
    return Object.entries(priceRanges)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'any';
  }

  private isPriceInRange(price: number, range: string): boolean {
    switch (range) {
      case '0-100': return price <= 100;
      case '100-300': return price > 100 && price <= 300;
      case '300-500': return price > 300 && price <= 500;
      case '500-1000': return price > 500 && price <= 1000;
      case '1000+': return price > 1000;
      default: return true;
    }
  }

  private generateContextualActions(intent: any, profile: any, insights: any): string[] {
    const actions: string[] = [];

    // Actions based on intent
    if (intent.category === 'browsing') {
      actions.push('show_more_products', 'apply_filters');
    } else if (intent.category === 'buying') {
      actions.push('check_availability', 'show_payment_options', 'apply_discounts');
    } else if (intent.category === 'comparing') {
      actions.push('create_comparison_table', 'highlight_key_differences');
    }

    // Actions based on profile
    if (profile.behaviorPatterns.browsingStyle === 'price_conscious') {
      actions.push('show_deals', 'highlight_discounts');
    }

    if (profile.emotionalProfile.urgencyLevel > 0.7) {
      actions.push('expedite_checkout', 'show_fast_shipping');
    }

    if (insights.customerType === 'analytical_buyer') {
      actions.push('provide_detailed_specs', 'show_reviews');
    }

    return actions;
  }

  private generateSmartFollowUps(intent: any, profile: any, conversationHistory: any[]): string[] {
    const followUps: string[] = [];

    // Intent-based follow-ups
    if (intent.category === 'browsing') {
      followUps.push("Would you like to see products in a specific price range?");
      followUps.push("Are you looking for any particular brand?");
    } else if (intent.category === 'buying') {
      followUps.push("Would you like to know about our current shipping options?");
      followUps.push("Are you interested in our protection plan for this item?");
    }

    // Profile-based follow-ups
    if (profile.preferences.categories && Object.keys(profile.preferences.categories).length > 0) {
      const topCategory = Object.entries(profile.preferences.categories)
        .sort(([,a], [,b]) => (b as number) - (a as number))[0][0];
      followUps.push(`I noticed you're interested in ${topCategory}. Would you like to see our latest arrivals?`);
    }

    // Contextual follow-ups based on conversation stage
    if (conversationHistory.length > 5) {
      followUps.push("Based on our conversation, would you like me to create a personalized recommendation list?");
    }

    // Objection handling follow-ups
    if (profile.contextualState.objections.includes('price')) {
      followUps.push("Would you like to see similar items at a lower price point?");
    }

    return followUps.slice(0, 2); // Limit to 2 follow-ups to avoid overwhelming
  }

  private generateUIElements(intent: any, profile: any, products: Product[]): SmartResponse['uiElements'] {
    const uiElements: SmartResponse['uiElements'] = {
      showCarousel: false,
      showFilters: false,
      showComparison: false,
      quickActions: [],
      urgencyIndicators: [],
      socialProof: []
    };

    // Show carousel for browsing intent with multiple products
    if (intent.category === 'browsing' && products.length > 1) {
      uiElements.showCarousel = true;
    }

    // Show filters for research-heavy users
    if (profile.behaviorPatterns.browsingStyle === 'research_heavy') {
      uiElements.showFilters = true;
    }

    // Show comparison for comparing intent
    if (intent.category === 'comparing') {
      uiElements.showComparison = true;
    }

    // Quick actions based on user type
    if (profile.behaviorPatterns.browsingStyle === 'quick_decision') {
      uiElements.quickActions = ['Add to Cart', 'Buy Now', 'View Details'];
    } else {
      uiElements.quickActions = ['See Similar', 'Compare', 'Save for Later', 'View Details'];
    }

    // Add perfume-specific features
    if (profile.preferences.categories?.perfume || profile.preferences.categories?.fragrance) {
      uiElements.quickActions.push('Choose Scent Type', 'Size Options', 'Gift Wrap');
    }

    // Add watch-specific features
    if (profile.preferences.categories?.watch) {
      uiElements.quickActions.push('Watch Collection', 'Band Material', 'Face Color');
    }

    // Urgency indicators
    if (profile.emotionalProfile.urgencyLevel > 0.7) {
      uiElements.urgencyIndicators = ['Limited Stock', 'Fast Shipping Available'];
    }

    // Social proof elements
    if (products.length > 0) {
      uiElements.socialProof = [
        'Highly rated by customers',
        'Popular choice this month',
        'Recently viewed by 50+ customers'
      ];
    }

    return uiElements;
  }

  private generateNextBestActions(intent: any, profile: any, insights: any): string[] {
    const actions: string[] = [];

    switch (insights.recommendedApproach) {
      case 'create_urgency_and_excitement':
        actions.push('show_limited_time_offers', 'highlight_exclusive_deals');
        break;
      case 'provide_detailed_comparisons':
        actions.push('create_comparison_matrix', 'show_detailed_specifications');
        break;
      case 'emphasize_deals_and_savings':
        actions.push('highlight_biggest_discounts', 'show_bundle_offers');
        break;
      case 'offer_exclusive_recommendations':
        actions.push('personalized_curation', 'vip_early_access');
        break;
      default:
        actions.push('build_rapport', 'understand_needs_better');
    }

    return actions;
  }

  private extractPreviousInterests(conversationHistory: any[]): string[] {
    const interests: string[] = [];
    const recentMessages = conversationHistory.slice(-3);
    
    recentMessages.forEach(message => {
      const content = typeof message.content === 'string' 
        ? message.content.toLowerCase() 
        : typeof message.content === 'object' 
          ? JSON.stringify(message.content).toLowerCase() 
          : '';
      ['perfume', 'watch', 'jewelry', 'skincare'].forEach(category => {
        if (content.includes(category) && !interests.includes(category)) {
          interests.push(category);
        }
      });
    });

    return interests;
  }

  // Contextual follow-up system
  public generateContextualFollowUps(sessionId: string, conversationHistory: any[]): ContextualFollowUp[] {
    const profile = userProfileService.getOrCreateProfile(sessionId);
    const followUps: ContextualFollowUp[] = [];

    // Browser abandonment follow-up
    followUps.push({
      trigger: 'browsing_without_engagement',
      message: "I noticed you're browsing our collection. Would you like me to recommend products based on your interests?",
      timing: 30,
      condition: (profile, conversation) => 
        conversation.length > 3 && 
        profile.behaviorPatterns.browsingStyle === 'research_heavy' &&
        !conversation.slice(-3).some((msg: any) => msg.content.includes('buy'))
    });

    // Price objection follow-up
    followUps.push({
      trigger: 'price_objection',
      message: "I understand budget is important. Let me show you some great alternatives that offer excellent value for money.",
      timing: 10,
      condition: (profile, conversation) => 
        profile.contextualState.objections.includes('price')
    });

    // High engagement follow-up
    followUps.push({
      trigger: 'high_engagement',
      message: "You seem really interested in these products! Would you like me to check if we have any special promotions available?",
      timing: 45,
      condition: (profile, conversation) => 
        profile.emotionalProfile.enthusiasmLevel > 0.7 &&
        conversation.length > 5
    });

    // Decision stage follow-up
    followUps.push({
      trigger: 'decision_hesitation',
      message: "I can see you're considering your options carefully. Would it help if I highlighted the key benefits of your top choices?",
      timing: 60,
      condition: (profile, conversation) => 
        profile.contextualState.decisionStage === 'consideration' &&
        conversation.length > 4
    });

    return followUps.filter(followUp => followUp.condition(profile, conversationHistory));
  }

  // Memory triggers for returning users
  public generateMemoryTriggers(sessionId: string): string[] {
    const profile = userProfileService.getOrCreateProfile(sessionId);
    const triggers: string[] = [];

    // Previous interest triggers
    if (profile.learningMetrics.clickedProducts.length > 0) {
      triggers.push(`Welcome back! I remember you were interested in some of our premium products. We have some new arrivals you might like.`);
    }

    // Abandoned cart equivalent (clicked but didn't "purchase")
    if (profile.learningMetrics.clickedProducts.length > 2 && profile.behaviorPatterns.purchaseHistory.length === 0) {
      triggers.push(`I see you've been exploring several products. Would you like me to create a personalized comparison for your favorites?`);
    }

    // Preference-based triggers
    const topCategory = Object.entries(profile.preferences.categories || {})
      .sort(([,a], [,b]) => (b as number) - (a as number))[0];
    
    if (topCategory && topCategory[1] > 0.3) {
      triggers.push(`Based on your interest in ${topCategory[0]}, I have some exciting new recommendations for you.`);
    }

    return triggers;
  }
}

export const smartResponseService = SmartResponseService.getInstance();