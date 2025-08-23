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

    // Debug: Log the RAG context to see what products we have
    console.log('SmartResponse - RAG Context:', {
      hasProducts: !!ragContext.products,
      productCount: ragContext.products?.length || 0,
      firstProduct: ragContext.products?.[0] || 'No products'
    });

    // Enhance AI response with intelligence
    const enhancedMessage = this.enhanceResponseWithIntelligence(
      aiResponse,
      intent,
      profile,
      insights,
      conversationHistory
    );

    // Generate smart product recommendations
    let smartProducts = this.selectSmartProducts(ragContext.products, profile, intent);
    
    // Debug: Log the smart products
    console.log('SmartResponse - Smart Products:', {
      count: smartProducts.length,
      products: smartProducts.map(p => ({ id: p.id, title: p.title, price: p.price }))
    });

    // CRITICAL: Don't return products when clarification is needed
    console.log('Intent analysis:', { 
      category: intent.category, 
      actions: intent.actions, 
      willClearProducts: intent.category === 'support' && intent.actions.includes('ask_clarifying_questions')
    });
    
    if (intent.category === 'support' && intent.actions.includes('ask_clarifying_questions')) {
      console.log('Clearing products due to clarification request');
      smartProducts = []; // Clear products for clarification requests
    }

    // Generate contextual actions
    const actions = this.generateContextualActions(intent, profile, insights);

    // Generate follow-up questions
    const followUpQuestions = this.generateSmartFollowUps(intent, profile, conversationHistory, userMessage, aiResponse, smartProducts);

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

    // AI model handles spelling corrections, so no need for manual correction handling here
    
    // CRITICAL: Handle case when no products are found for the requested category
    // Check if this is a category-specific request that returned no products
    const categoryHints = intent.entities?.categories || [];
    if (categoryHints.length > 0 && (baseResponse.includes("don't have") || baseResponse.includes("don't have"))) {
      const categoryNames = categoryHints.map((cat: string) => {
        if (cat === 'watch') return 'watches';
        if (cat === 'fragrance') return 'fragrances';
        if (cat === 'accessory') return 'accessories';
        if (cat === 'bath') return 'bath products';
        return cat + 's';
      });
      
      // Create list of available categories excluding the one they asked for
      const availableCategories = ['luxury fragrances', 'premium accessories', 'exquisite watches', 'beauty products'];
      const filteredCategories = availableCategories.filter(cat => 
        !categoryNames.some((requestedCat: string) => cat.includes(requestedCat.slice(0, -1))) // Remove 's' and check if category contains it
      );
      
      enhanced = `I apologize, but we currently don't have ${categoryNames.join(' or ')} available right now. However, we do specialize in ${filteredCategories.join(', ')}. Would you like me to show you some of our available products instead?`;
    }

    // Strip markdown formatting to show clean text and convert tables to readable format
    enhanced = enhanced
      .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove **bold**
      .replace(/\*(.*?)\*/g, '$1')      // Remove *italic*
      .replace(/#{1,6}\s+/g, '')       // Remove # headers
      .replace(/`([^`]+)`/g, '$1')     // Remove `code`
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove [link](url)
      .replace(/\|([^|\n]+)\|/g, (match, content) => content.trim() + ' ') // Convert table cells to text
      .replace(/^\|.*\|$/gm, '') // Remove table separator lines
      .replace(/\|/g, ' - ')     // Convert remaining pipes to dashes
      .replace(/\s+/g, ' ')      // Clean up multiple spaces
      .trim();

    // Only truncate if extremely long (over 2500 characters for location listings)
    if (enhanced.length > 2500) {
      enhanced = enhanced.substring(0, 2400).trim();
      // Ensure we end at a complete sentence or line
      const lastPeriod = enhanced.lastIndexOf('.');
      const lastExclamation = enhanced.lastIndexOf('!');
      const lastQuestion = enhanced.lastIndexOf('?');
      const lastNewline = enhanced.lastIndexOf('\n');
      const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion, lastNewline);
      
      if (lastSentenceEnd > 1200) {
        enhanced = enhanced.substring(0, lastSentenceEnd + 1);
      }
    }

    // Add brief personalization only if needed
    if (profile.preferences.categories && typeof profile.preferences.categories === 'object' && Object.keys(profile.preferences.categories).length > 0) {
      const topCategory = Object.entries(profile.preferences.categories)
        .sort(([,a], [,b]) => (b as number) - (a as number))[0][0];
      
      if (conversationHistory.length > 3 && !enhanced.includes(topCategory)) {
        enhanced = `Perfect for ${topCategory} enthusiasts! ` + enhanced;
      }
    }

    return enhanced;
  }

  private selectSmartProducts(products: Product[], profile: any, intent: any): any[] {
    if (!products || products.length === 0) return [];

    let scoredProducts = products.map(product => ({
      ...product,
      score: this.calculateProductScore(product, profile, intent)
    }));

    // Sort by score and return top products
    scoredProducts.sort((a, b) => b.score - a.score);
    
    // Show 4 products consistently for better user choice
    const limit = 4;
    
    // Transform products to ensure they have all required fields for frontend
    const transformedProducts = scoredProducts.slice(0, limit).map(product => ({
      id: product.id || `product_${Date.now()}_${Math.random()}`,
      title: product.title || 'Product Title Not Available',
      description: product.description || '',
      price: product.price || product.originalPrice || 'Price not available',
      discountPrice: product.discountPrice || undefined,
      imageLink: product.imageLink || undefined,
      link: product.link || undefined,
      brand: product.brand || undefined,
      availability: product.availability || 'unknown',
      category: (product as any).additionalFields?.product_type || 'General',
      similarity: (product as any).score || 0
    }));
    
    return transformedProducts;
  }

  private calculateProductScore(product: Product, profile: any, intent: any): number {
    let score = 10; // Base relevance score for all products

    // Intent-based keyword matching (critical for new users)
    const searchTerms = intent.searchTerms || [];
    const productText = `${product.title} ${product.description} ${product.brand}`.toLowerCase();
    
    searchTerms.forEach((term: string) => {
      if (productText.includes(term.toLowerCase())) {
        score += 15; // High score for direct matches
      }
    });

    // Category matching based on query intent
    if (intent.entities?.categories) {
      intent.entities.categories.forEach((category: string) => {
        const categoryLower = category.toLowerCase();
        if (productText.includes(categoryLower) || 
            (category === 'fragrance' && (productText.includes('perfume') || productText.includes('fragrance'))) ||
            (category === 'perfume' && (productText.includes('perfume') || productText.includes('fragrance'))) ||
            (category === 'watch' && productText.includes('watch')) ||
            (category === 'accessory' && productText.includes('accessory'))) {
          score += 20;
        }
      });
    }

    // Category preference matching (for established users)
    Object.entries(profile.preferences.categories || {}).forEach(([category, weight]) => {
      if (product.title?.toLowerCase().includes(category.toLowerCase()) || 
          product.description?.toLowerCase().includes(category.toLowerCase())) {
        score += (weight as number) * 10;
      }
    });

    // Brand preference matching (for established users)
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
    if (product.additionalFields && typeof product.additionalFields === 'object' && product.additionalFields && 'popularity' in product.additionalFields && product.additionalFields.popularity) {
      score += Number(product.additionalFields.popularity) * 2;
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

  private generateSmartFollowUps(intent: any, profile: any, conversationHistory: any[], userMessage: string, aiResponse: string, products: any[] = []): string[] {
    const followUps: string[] = [];
    
    // Extract key information from the AI response to generate contextual follow-ups
    const aiResponseLower = aiResponse.toLowerCase();
    const userMessageLower = userMessage.toLowerCase();
    
    // Check for purchase confirmation
    const isPurchaseConfirmation = userMessageLower.includes('yes, i want to buy') || 
                                  userMessageLower.includes('yes i want to buy') ||
                                  intent.actions.includes('confirm_purchase_intent');

    // Priority 1: Purchase confirmation responses
    if (isPurchaseConfirmation) {
      followUps.push("Add to cart and checkout");
      followUps.push("I need help choosing the right size/option");
      followUps.push("Tell me about shipping and delivery");
      followUps.push("I have questions about this product");
      return followUps;
    }

    // Analyze AI response content to generate dynamic follow-ups
    const responseAnalysis = this.analyzeResponseContent(aiResponse, userMessage, products);
    
    // Generate contextual follow-ups based on response analysis
    if (responseAnalysis.showedProducts && products.length > 0) {
      // AI showed products - generate product-specific follow-ups
      const productNames = products.slice(0, 2).map(p => p.title || 'this product');
      
      if (products.length > 1) {
        followUps.push("These look perfect for what I need");
        followUps.push(`Tell me more about ${productNames[0]}`);
        followUps.push("I want to compare these options");
        followUps.push("Show me similar products");
      } else {
        followUps.push("This looks perfect for what I need");
        followUps.push("Tell me more about this product");
        followUps.push("I want to see similar options");
        followUps.push("I'm ready to purchase this");
      }
    } else if (responseAnalysis.askedQuestion) {
      // AI asked a question - generate answers based on the question type
      if (responseAnalysis.questionType === 'preference') {
        // Generate category-appropriate preference questions
        if (userMessageLower.includes('perfume') || userMessageLower.includes('fragrance') || userMessageLower.includes('cologne')) {
          followUps.push("I prefer something fresh and light");
          followUps.push("I like woody or musky scents");
          followUps.push("I'm buying for myself");
          followUps.push("I'm looking for a gift");
        } else if (userMessageLower.includes('hand cream') || userMessageLower.includes('soap') || userMessageLower.includes('beauty')) {
          followUps.push("I prefer something moisturizing");
          followUps.push("I have sensitive skin");
          followUps.push("I'm buying for myself");
          followUps.push("I'm looking for a gift");
        } else if (userMessageLower.includes('watch') || userMessageLower.includes('timepiece')) {
          followUps.push("I prefer something elegant and classic");
          followUps.push("I like modern and sporty styles");
          followUps.push("I'm buying for myself");
          followUps.push("I'm looking for a gift");
        } else if (userMessageLower.includes('accessory') || userMessageLower.includes('jewelry') || userMessageLower.includes('bracelet')) {
          followUps.push("I prefer something elegant and classic");
          followUps.push("I like modern and trendy styles");
          followUps.push("I'm buying for myself");
          followUps.push("I'm looking for a gift");
        } else {
          // Generic preference questions
          followUps.push("I prefer something elegant and classic");
          followUps.push("I like modern and trendy styles");
          followUps.push("I'm buying for myself");
          followUps.push("I'm looking for a gift");
        }
      } else if (responseAnalysis.questionType === 'price') {
        followUps.push("Under 200 AED");
        followUps.push("Between 200-500 AED");
        followUps.push("I'm flexible with budget");
        followUps.push("Show me the best deals");
      } else if (responseAnalysis.questionType === 'gender') {
        // Generate category-appropriate gender questions
        if (userMessageLower.includes('perfume') || userMessageLower.includes('fragrance') || userMessageLower.includes('cologne')) {
          followUps.push("Men's fragrances");
          followUps.push("Women's perfumes");
          followUps.push("Unisex options");
          followUps.push("It's for someone else");
        } else if (userMessageLower.includes('watch') || userMessageLower.includes('accessory')) {
          followUps.push("Men's watches/accessories");
          followUps.push("Women's watches/accessories");
          followUps.push("Unisex options");
          followUps.push("It's for someone else");
        } else {
          followUps.push("Men's products");
          followUps.push("Women's products");
          followUps.push("Unisex options");
          followUps.push("It's for someone else");
        }
      }
    } else if (responseAnalysis.providedInformation) {
      // AI provided information - generate follow-up exploration
      if (responseAnalysis.topicMentioned.includes('brand')) {
        followUps.push("Tell me about other brands you carry");
        followUps.push("I want to see products from this brand");
        followUps.push("What makes this brand special?");
        followUps.push("Do you have any deals on this brand?");
      } else if (responseAnalysis.topicMentioned.includes('shipping')) {
        followUps.push("What are the shipping costs?");
        followUps.push("How fast is delivery to my area?");
        followUps.push("Do you offer express shipping?");
        followUps.push("Let's continue browsing products");
      } else if (responseAnalysis.topicMentioned.includes('categories')) {
        // Generate category-appropriate follow-ups based on user's query
        if (userMessageLower.includes('perfume') || userMessageLower.includes('fragrance') || userMessageLower.includes('cologne')) {
          followUps.push("Show me men's fragrances");
          followUps.push("I want to see women's perfumes");
          followUps.push("What are your most popular items?");
          followUps.push("Tell me about current offers");
        } else if (userMessageLower.includes('watch') || userMessageLower.includes('accessory')) {
          followUps.push("Show me men's watches");
          followUps.push("I want to see women's accessories");
          followUps.push("What are your most popular items?");
          followUps.push("Tell me about current offers");
        } else {
          followUps.push("Show me men's products");
          followUps.push("I want to see women's products");
          followUps.push("What are your most popular items?");
          followUps.push("Tell me about current offers");
        }
      }
    } else if (responseAnalysis.isWelcomeMessage) {
      // Welcome message - help user navigate
      if (userMessageLower.includes('perfume') || userMessageLower.includes('fragrance') || userMessageLower.includes('cologne')) {
        followUps.push("Show me your best-selling perfumes");
        followUps.push("I'm looking for something under 300 AED");
        followUps.push("What's good for everyday wear?");
        followUps.push("I need a gift recommendation");
      } else if (userMessageLower.includes('watch') || userMessageLower.includes('accessory')) {
        followUps.push("Show me your best-selling watches");
        followUps.push("I'm looking for something under 300 AED");
        followUps.push("What's good for everyday wear?");
        followUps.push("I need a gift recommendation");
      } else {
        followUps.push("Show me your bestsellers");
        followUps.push("I'm looking for something under 300 AED");
        followUps.push("What's good for everyday wear?");
        followUps.push("I need a gift recommendation");
      }
    }

    // If no specific follow-ups were generated, create contextual ones based on conversation stage
    if (followUps.length === 0) {
      const isNewUser = conversationHistory.length <= 2;
      
      if (isNewUser) {
        // Generate category-appropriate new user follow-ups
        if (userMessageLower.includes('perfume') || userMessageLower.includes('fragrance') || userMessageLower.includes('cologne')) {
          followUps.push("Show me your bestsellers");
          followUps.push("I'm looking for men's cologne");
          followUps.push("I want women's perfumes");
          followUps.push("What are your current deals?");
        } else if (userMessageLower.includes('watch') || userMessageLower.includes('accessory')) {
          followUps.push("Show me your bestsellers");
          followUps.push("I'm looking for men's watches");
          followUps.push("I want women's accessories");
          followUps.push("What are your current deals?");
        } else {
          followUps.push("Show me your bestsellers");
          followUps.push("I'm looking for men's products");
          followUps.push("I want women's products");
          followUps.push("What are your current deals?");
        }
      } else {
        followUps.push("I need help choosing");
        followUps.push("Tell me about shipping");
        followUps.push("Show me more options");
        followUps.push("I'm ready to buy");
      }
    }

    return followUps.slice(0, 4); // Show up to 4 contextual options
  }

  private analyzeResponseContent(aiResponse: string, userMessage: string, products: any[]): {
    showedProducts: boolean;
    askedQuestion: boolean;
    questionType: 'preference' | 'price' | 'gender' | 'general' | null;
    providedInformation: boolean;
    topicMentioned: string[];
    isWelcomeMessage: boolean;
  } {
    const responseLower = aiResponse.toLowerCase();
    const userLower = userMessage.toLowerCase();
    
    // Check if AI showed products
    const showedProducts = products.length > 0 || 
                          responseLower.includes('aed') || 
                          responseLower.includes('price:') ||
                          responseLower.includes('here are');
    
    // Check if AI asked a question
    const askedQuestion = responseLower.includes('?') || 
                         responseLower.includes('what are you looking for') ||
                         responseLower.includes('would you prefer') ||
                         responseLower.includes('are you interested in');
    
    // Determine question type
    let questionType: 'preference' | 'price' | 'gender' | 'general' | null = null;
    if (askedQuestion) {
      if (responseLower.includes('prefer') || responseLower.includes('scent') || responseLower.includes('fragrance type')) {
        questionType = 'preference';
      } else if (responseLower.includes('budget') || responseLower.includes('price') || responseLower.includes('spend')) {
        questionType = 'price';
      } else if (responseLower.includes('men') || responseLower.includes('women') || responseLower.includes('gender')) {
        questionType = 'gender';
      } else {
        questionType = 'general';
      }
    }
    
    // Check if AI provided information
    const providedInformation = responseLower.includes('karjistore') || 
                               responseLower.includes('we offer') ||
                               responseLower.includes('our store') ||
                               responseLower.includes('specialize in');
    
    // Extract topics mentioned
    const topicMentioned: string[] = [];
    if (responseLower.includes('brand') || responseLower.includes('designer')) topicMentioned.push('brand');
    if (responseLower.includes('shipping') || responseLower.includes('delivery')) topicMentioned.push('shipping');
    if (responseLower.includes('categories') || responseLower.includes('perfume') || responseLower.includes('fragrance')) topicMentioned.push('categories');
    if (responseLower.includes('deal') || responseLower.includes('offer') || responseLower.includes('discount')) topicMentioned.push('deals');
    
    // Check if it's a welcome message
    const isWelcomeMessage = (userLower.includes('hi') || userLower.includes('hello') || userLower === '') &&
                            (responseLower.includes('welcome') || responseLower.includes('how can i help'));
    
    return {
      showedProducts,
      askedQuestion,
      questionType,
      providedInformation,
      topicMentioned,
      isWelcomeMessage
    };
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

    // CRITICAL: Don't show any UI elements when clarification is needed
    if (intent.category === 'support' && intent.actions.includes('ask_clarifying_questions')) {
      return uiElements; // Return empty UI elements for clarification requests
    }

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