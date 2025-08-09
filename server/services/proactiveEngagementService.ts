import { userProfileService } from './userProfileService.js';
import { liveInventoryService } from './liveInventoryService.js';
import { conversationService } from './conversationService.js';

export interface ProactiveMessage {
  type: 'welcome' | 'nudge' | 'offer' | 'reminder' | 'recommendation' | 'urgency' | 'social_proof';
  trigger: string;
  message: string;
  timing: number; // seconds to wait before showing
  priority: 'low' | 'medium' | 'high';
  conditions: (profile: any, conversation: any[], context: any) => boolean;
  actions?: string[];
  products?: any[];
}

export interface BehavioralTrigger {
  name: string;
  pattern: RegExp | ((conversation: any[]) => boolean);
  response: ProactiveMessage;
  cooldown: number; // minutes before trigger can fire again
  maxOccurrences: number;
}

class ProactiveEngagementService {
  private static instance: ProactiveEngagementService;
  private triggerHistory: Map<string, { lastTriggered: Date; count: number }> = new Map();

  static getInstance(): ProactiveEngagementService {
    if (!ProactiveEngagementService.instance) {
      ProactiveEngagementService.instance = new ProactiveEngagementService();
    }
    return ProactiveEngagementService.instance;
  }

  private behavioralTriggers: BehavioralTrigger[] = [
    {
      name: 'browsing_hesitation',
      pattern: (conversation: any[]) => {
        return conversation.length > 3 && 
               conversation.slice(-3).every((msg: any) => msg.role === 'user' && 
               (msg.content.includes('show me') || msg.content.includes('looking for'))) &&
               !conversation.some((msg: any) => msg.content.includes('buy') || msg.content.includes('purchase'));
      },
      response: {
        type: 'nudge',
        trigger: 'browsing_hesitation',
        message: "I can see you're exploring our collection! Would you like me to narrow down the options based on what you're most interested in? I can also show you our current best deals.",
        timing: 30,
        priority: 'medium',
        conditions: (profile, conversation, context) => profile.emotionalProfile.enthusiasmLevel < 0.6,
        actions: ['show_personalized_deals', 'apply_smart_filters']
      },
      cooldown: 10,
      maxOccurrences: 2
    },

    {
      name: 'price_sensitivity',
      pattern: /\b(expensive|costly|cheap|budget|price|cost|deal|discount)\b/i,
      response: {
        type: 'offer',
        trigger: 'price_sensitivity',
        message: "I understand budget is important! Let me show you our best value options and current promotions. We also have a price match guarantee.",
        timing: 5,
        priority: 'high',
        conditions: (profile, conversation, context) => profile.contextualState.objections.includes('price'),
        actions: ['show_budget_options', 'highlight_deals', 'offer_price_match']
      },
      cooldown: 15,
      maxOccurrences: 1
    },

    {
      name: 'high_engagement',
      pattern: (conversation: any[]) => {
        return conversation.length > 6 && 
               conversation.filter((msg: any) => msg.role === 'user').length > 3 &&
               conversation.slice(-5).some((msg: any) => 
                 msg.content.includes('love') || 
                 msg.content.includes('perfect') || 
                 msg.content.includes('exactly')
               );
      },
      response: {
        type: 'recommendation',
        trigger: 'high_engagement',
        message: "You seem really excited about these products! Since you have great taste, would you like to see our exclusive collection or get early access to new arrivals?",
        timing: 20,
        priority: 'high',
        conditions: (profile, conversation, context) => profile.emotionalProfile.enthusiasmLevel > 0.7,
        actions: ['show_exclusive_collection', 'offer_vip_access', 'personalized_curation']
      },
      cooldown: 20,
      maxOccurrences: 1
    },

    {
      name: 'decision_paralysis',
      pattern: (conversation: any[]) => {
        const userMessages = conversation.filter((msg: any) => msg.role === 'user');
        return userMessages.length > 4 &&
               userMessages.slice(-3).some((msg: any) => 
                 msg.content.includes('compare') || 
                 msg.content.includes('which one') || 
                 msg.content.includes('not sure') ||
                 msg.content.includes('help me decide')
               );
      },
      response: {
        type: 'recommendation',
        trigger: 'decision_paralysis',
        message: "I can see you're carefully considering your options - that's smart! Let me help by highlighting the key differences and recommending the best choice based on your preferences.",
        timing: 15,
        priority: 'medium',
        conditions: (profile, conversation, context) => profile.contextualState.decisionStage === 'consideration',
        actions: ['create_comparison_table', 'highlight_best_choice', 'simplify_decision']
      },
      cooldown: 12,
      maxOccurrences: 2
    },

    {
      name: 'urgency_opportunity',
      pattern: (conversation: any[]) => {
        return conversation.some((msg: any) => 
          msg.content.includes('quick') || 
          msg.content.includes('urgent') || 
          msg.content.includes('need soon') ||
          msg.content.includes('asap')
        );
      },
      response: {
        type: 'urgency',
        trigger: 'urgency_opportunity',
        message: "I understand you need this quickly! Good news - I can prioritize items that are in stock and available for express shipping. Plus, we have same-day delivery in some areas.",
        timing: 3,
        priority: 'high',
        conditions: (profile, conversation, context) => profile.emotionalProfile.urgencyLevel > 0.6,
        actions: ['prioritize_in_stock', 'show_fast_shipping', 'offer_express_delivery']
      },
      cooldown: 30,
      maxOccurrences: 1
    },

    {
      name: 'gift_opportunity',
      pattern: /\b(gift|present|birthday|anniversary|valentine|mother|father|christmas|holiday)\b/i,
      response: {
        type: 'recommendation',
        trigger: 'gift_opportunity',
        message: "Shopping for a gift? That's wonderful! I can help you find the perfect present and even arrange beautiful gift wrapping with a personalized message.",
        timing: 5,
        priority: 'medium',
        conditions: (profile, conversation, context) => profile.contextualState.motivations.includes('gift'),
        actions: ['show_gift_options', 'offer_gift_wrapping', 'suggest_gift_sets']
      },
      cooldown: 25,
      maxOccurrences: 1
    },

    {
      name: 'abandonment_risk',
      pattern: (conversation: any[]) => {
        const lastUserMessage = conversation.filter((msg: any) => msg.role === 'user').slice(-1)[0];
        return lastUserMessage && 
               (lastUserMessage.content.includes('maybe later') ||
                lastUserMessage.content.includes('think about it') ||
                lastUserMessage.content.includes('not now') ||
                lastUserMessage.content.length < 10); // Short, disengaged responses
      },
      response: {
        type: 'offer',
        trigger: 'abandonment_risk',
        message: "Before you go, I'd love to help you find exactly what you're looking for! How about I save your favorites and send you a special discount code for when you're ready?",
        timing: 10,
        priority: 'high',
        conditions: (profile, conversation, context) => profile.emotionalProfile.enthusiasmLevel < 0.4,
        actions: ['save_favorites', 'offer_discount', 'schedule_follow_up']
      },
      cooldown: 45,
      maxOccurrences: 1
    },

    {
      name: 'technical_interest',
      pattern: /\b(ingredients|specifications|details|how it works|technical|formula|materials)\b/i,
      response: {
        type: 'recommendation',
        trigger: 'technical_interest',
        message: "I love that you're interested in the technical details! You clearly know your stuff. Let me show you our professional-grade products with detailed specifications.",
        timing: 8,
        priority: 'medium',
        conditions: (profile, conversation, context) => profile.behaviorPatterns.browsingStyle === 'research_heavy',
        actions: ['show_detailed_specs', 'highlight_professional_products', 'provide_technical_info']
      },
      cooldown: 20,
      maxOccurrences: 1
    }
  ];

  public async generateProactiveMessages(
    sessionId: string, 
    conversation: any[], 
    context: any
  ): Promise<ProactiveMessage[]> {
    const profile = userProfileService.getOrCreateProfile(sessionId);
    const messages: ProactiveMessage[] = [];

    // Check each behavioral trigger
    for (const trigger of this.behavioralTriggers) {
      if (this.shouldTrigger(trigger, sessionId, conversation, profile, context)) {
        // Check conditions
        if (trigger.response.conditions(profile, conversation, context)) {
          messages.push(trigger.response);
          this.recordTrigger(trigger.name, sessionId);
        }
      }
    }

    // Add inventory-based proactive messages
    const inventoryMessages = await this.generateInventoryBasedMessages(sessionId, context);
    messages.push(...inventoryMessages);

    // Add time-based proactive messages
    const timeBasedMessages = this.generateTimeBasedMessages(sessionId, profile, conversation);
    messages.push(...timeBasedMessages);

    // Sort by priority and timing
    return messages
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, 2); // Limit to 2 proactive messages to avoid overwhelming
  }

  private shouldTrigger(
    trigger: BehavioralTrigger, 
    sessionId: string, 
    conversation: any[], 
    profile: any, 
    context: any
  ): boolean {
    const triggerKey = `${sessionId}_${trigger.name}`;
    const history = this.triggerHistory.get(triggerKey);

    // Check cooldown
    if (history) {
      const timeSinceLastTrigger = Date.now() - history.lastTriggered.getTime();
      if (timeSinceLastTrigger < trigger.cooldown * 60 * 1000) {
        return false;
      }

      // Check max occurrences
      if (history.count >= trigger.maxOccurrences) {
        return false;
      }
    }

    // Check pattern match
    if (trigger.pattern instanceof RegExp) {
      const lastUserMessage = conversation.filter((msg: any) => msg.role === 'user').slice(-1)[0];
      return lastUserMessage && trigger.pattern.test(lastUserMessage.content);
    } else if (typeof trigger.pattern === 'function') {
      return trigger.pattern(conversation);
    }

    return false;
  }

  private recordTrigger(triggerName: string, sessionId: string): void {
    const triggerKey = `${sessionId}_${triggerName}`;
    const history = this.triggerHistory.get(triggerKey) || { lastTriggered: new Date(0), count: 0 };
    
    history.lastTriggered = new Date();
    history.count++;
    
    this.triggerHistory.set(triggerKey, history);
  }

  private async generateInventoryBasedMessages(sessionId: string, context: any): Promise<ProactiveMessage[]> {
    const messages: ProactiveMessage[] = [];
    
    if (context.products && context.products.length > 0) {
      for (const product of context.products.slice(0, 2)) {
        const inventory = await liveInventoryService.getInventoryStatus(product.id);
        const socialProof = await liveInventoryService.getSocialProof(product.id);

        // Low stock urgency
        if (inventory.stock <= 5 && inventory.stock > 0) {
          messages.push({
            type: 'urgency',
            trigger: 'low_stock',
            message: `Quick heads up: Only ${inventory.stock} left of "${product.title}" - this popular item tends to sell out fast!`,
            timing: 15,
            priority: 'high',
            conditions: () => true,
            actions: ['show_stock_status', 'offer_quick_checkout'],
            products: [product]
          });
        }

        // High demand social proof
        if (socialProof.recentPurchases > 15) {
          messages.push({
            type: 'social_proof',
            trigger: 'high_demand',
            message: `"${product.title}" is really popular right now - ${socialProof.recentPurchases} people bought it recently! Would you like to secure yours?`,
            timing: 20,
            priority: 'medium',
            conditions: () => true,
            actions: ['show_social_proof', 'offer_quick_add'],
            products: [product]
          });
        }
      }
    }

    return messages;
  }

  private generateTimeBasedMessages(sessionId: string, profile: any, conversation: any[]): ProactiveMessage[] {
    const messages: ProactiveMessage[] = [];
    const now = new Date();
    const hour = now.getHours();

    // Welcome back message for returning users
    if (conversation.length === 1 && profile.behaviorPatterns.messageFrequency > 1) {
      messages.push({
        type: 'welcome',
        trigger: 'returning_user',
        message: `Welcome back! I remember you were interested in ${profile.preferences.categories ? Object.keys(profile.preferences.categories)[0] : 'our products'}. We have some exciting new arrivals you might love!`,
        timing: 2,
        priority: 'medium',
        conditions: () => true,
        actions: ['show_new_arrivals', 'reference_previous_interests']
      });
    }

    // Time-sensitive offers based on time of day
    if (hour >= 9 && hour <= 11) { // Morning
      messages.push({
        type: 'offer',
        trigger: 'morning_special',
        message: "Good morning! Start your day with something special - we have a limited morning flash sale with extra 15% off selected items!",
        timing: 30,
        priority: 'low',
        conditions: (profile: any) => profile.behaviorPatterns.browsingStyle === 'quick_decision',
        actions: ['show_morning_deals', 'apply_flash_discount']
      });
    } else if (hour >= 18 && hour <= 20) { // Evening
      messages.push({
        type: 'offer',
        trigger: 'evening_special',
        message: "Perfect timing for some evening shopping! Treat yourself - we have special evening discounts available right now.",
        timing: 25,
        priority: 'low',
        conditions: (profile: any) => profile.emotionalProfile.enthusiasmLevel > 0.5,
        actions: ['show_evening_deals', 'suggest_self_care']
      });
    }

    return messages;
  }

  // Smart interruption system
  public generateSmartInterruptions(sessionId: string, conversation: any[]): ProactiveMessage[] {
    const profile = userProfileService.getOrCreateProfile(sessionId);
    const interruptions: ProactiveMessage[] = [];

    // Interrupt with personalized offer during high engagement
    if (profile.emotionalProfile.enthusiasmLevel > 0.8 && conversation.length > 5) {
      interruptions.push({
        type: 'offer',
        trigger: 'high_engagement_interrupt',
        message: "You seem really excited about these products! Here's something exclusive - I can give you a special 20% discount if you decide in the next 10 minutes.",
        timing: 0, // Immediate
        priority: 'high',
        conditions: () => true,
        actions: ['apply_exclusive_discount', 'create_limited_time_offer']
      });
    }

    // Interrupt with alternative suggestion when user shows price concern
    if (profile.contextualState.objections.includes('price') && 
        conversation.length > 2) {
      interruptions.push({
        type: 'recommendation',
        trigger: 'price_alternative_interrupt',
        message: "Wait! Before you decide, let me show you this similar item that's 30% less expensive but still has excellent quality.",
        timing: 0,
        priority: 'high',
        conditions: () => true,
        actions: ['show_budget_alternatives', 'compare_value_options']
      });
    }

    return interruptions;
  }

  // Memory-triggered engagement
  public generateMemoryTriggeredMessages(sessionId: string): ProactiveMessage[] {
    const profile = userProfileService.getOrCreateProfile(sessionId);
    const messages: ProactiveMessage[] = [];

    // Trigger based on previous product clicks
    if (profile.learningMetrics.clickedProducts.length > 0) {
      const lastClickedCategory = this.inferCategoryFromProductId(
        profile.learningMetrics.clickedProducts.slice(-1)[0]
      );
      
      messages.push({
        type: 'recommendation',
        trigger: 'previous_interest_memory',
        message: `I remember you were interested in ${lastClickedCategory} products. We just got some amazing new arrivals in that category!`,
        timing: 5,
        priority: 'medium',
        conditions: () => true,
        actions: ['show_category_arrivals', 'reference_previous_clicks']
      });
    }

    // Trigger based on ignored suggestions (learn and adapt)
    if (profile.learningMetrics.ignoredSuggestions.length > 3) {
      messages.push({
        type: 'recommendation',
        trigger: 'learning_adaptation',
        message: "I notice my previous suggestions might not have been quite right. Let me try a different approach - what specific features are most important to you?",
        timing: 10,
        priority: 'medium',
        conditions: () => true,
        actions: ['ask_specific_preferences', 'refine_recommendations']
      });
    }

    return messages;
  }

  private inferCategoryFromProductId(productId: string): string {
    // Simple category inference (in production, would use product database)
    const categories = ['perfume', 'watch', 'jewelry', 'skincare'];
    return categories[Math.abs(productId.length) % categories.length];
  }
}

export const proactiveEngagementService = ProactiveEngagementService.getInstance();