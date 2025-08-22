import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { insertDocumentSchema, insertProductSchema, insertOfferSchema, insertApiConfigSchema, insertMerchantFeedSchema, insertUserSettingsSchema, type Product, type Document, type UserSettings, type InsertUserSettings } from "@shared/schema";
import { ragService } from "./services/ragService.js";
import { conversationService } from "./services/conversationService.js";
import { smartResponseService } from "./services/smartResponseService.js";
import { intentRecognitionService } from "./services/intentRecognition.js";
import { userProfileService } from "./services/userProfileService.js";
import { documentProcessor } from "./services/documentProcessor.js";
import { fileStorageService } from "./services/fileStorage.js";
import multer from "multer";
import fs from "fs";
import path from "path";
import { z } from "zod";
import xml2js from "xml2js";

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize RAG service and index existing documents
ragService.initialize().then(async () => {
  console.log('RAG service initialized, now indexing existing documents...');
  await ragService.indexAllDocuments();
  console.log('Existing documents indexed successfully');
}).catch(console.error);

// OpenRouter API call
async function callOpenRouterAPI(messages: any[], config: any) {
  const apiKey = process.env.OPENROUTER_API_KEY || config?.openrouterKey;
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://karjistore.com',
      'X-Title': 'KarjiStore AI Assistant'
    },
    body: JSON.stringify({
      model: config?.selectedModel || 'mistralai/mixtral-8x7b-instruct',
      messages,
      temperature: config?.temperature || 0.7,
      max_tokens: config?.maxTokens || 800,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Chat endpoint with conversation memory
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, sessionId } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Get or create conversation session
      const currentSessionId = conversationService.getOrCreateSession(sessionId);

      const config = await storage.getApiConfig();
      console.log('Chat config check:', { hasApiKey: !!config?.openrouterKey, selectedModel: config?.selectedModel });
      
      if (!config?.openrouterKey && !process.env.OPENROUTER_API_KEY) {
        return res.status(400).json({ error: "OpenRouter API key not configured" });
      }

      // Add user message to conversation history
      conversationService.addMessage(currentSessionId, 'user', message);

      // Get user preferences from conversation history 
      const userPreferences = conversationService.getUserPreferences(currentSessionId);
      const conversationContext = conversationService.getContextualPrompt(currentSessionId);


      // Analyze user intent first to determine if we need to search for products
      const intent = intentRecognitionService.analyzeIntent(message, conversationService.getMessages(currentSessionId) || []);
      
      // Check if this is a purchase confirmation - if so, don't search for new products
      const isPurchaseConfirmation = intent.actions.includes('confirm_purchase_intent') || 
                                   message.toLowerCase().includes('yes, i want to buy') ||
                                   message.toLowerCase().includes('yes i want to buy');
      
      let context;
      if (isPurchaseConfirmation) {
        // For purchase confirmation, don't search for new products - use empty context
        context = {
          products: [],
          documents: [],
          totalTokens: 0
        };
      } else {
        // Determine if we should search for products based on intent and user specificity
        const shouldSearchProducts = shouldSearchForProducts(intent, message, conversationService.getMessages(currentSessionId) || []);
        console.log('Product search decision details:', {
          shouldSearch: shouldSearchProducts,
          intent: intent.category,
          message: message.toLowerCase(),
          hasOpenTo: message.toLowerCase().includes('open to')
        });
        console.log('Intent details:', JSON.stringify(intent, null, 2));
        
        if (shouldSearchProducts) {
          // Check if user is asking for similar products based on previous conversation
          const isSearchingSimilarProducts = message.toLowerCase().includes('similar') || message.toLowerCase().includes('show me more');
          
          if (isSearchingSimilarProducts) {
            // Get context from previously shown products for similarity search
            const previousProducts = conversationService.getRecentlyShownProducts(currentSessionId);
            context = await ragService.findSimilarProducts(message, previousProducts, {
              maxDocuments: 2,
              maxProducts: 4,
              similarityThreshold: 0.3
            });
          } else {
            // Find relevant context using enhanced RAG with user preferences
            // Use original message since AI handles spelling correction
            const searchQuery = message;
            context = await ragService.findRelevantContext(searchQuery, {
              maxDocuments: 2,
              maxProducts: 4,
              similarityThreshold: 0.3
            }, conversationService.getMessages(currentSessionId) || []);
          }
        } else {
          // For general questions, only get documents (knowledge base) but not products
          const searchQuery = message;
          context = await ragService.findRelevantContext(searchQuery, {
            maxDocuments: 2,
            maxProducts: 0, // Don't search for products
            similarityThreshold: 0.3
          }, conversationService.getMessages(currentSessionId) || []);
        }
      }
      
      // Log context sizes for debugging
      console.log('Context sizes:', {
        products: context.products.length,
        documents: context.documents.length,
        totalProductsText: context.products.map(p => `${p.title}: ${p.description || ''}`).join('').length,
        totalDocumentsText: context.documents.map(d => d.content || '').join('').length
      });
      
      // Update user profile from message and intent analysis
      userProfileService.updateProfileFromMessage(currentSessionId, message, intent);
      
      const profile = userProfileService.getOrCreateProfile(currentSessionId);
      const insights = userProfileService.getProfileInsights(currentSessionId);
      const recommendations = userProfileService.getPersonalizedRecommendations(currentSessionId);

      // Create enhanced system prompt with intelligence
      const systemPrompt = `You are an advanced AI shopping assistant for KarjiStore.com with deep understanding of customer psychology and preferences. Your responses should be intelligent, personalized, and conversion-focused.

STORE OVERVIEW FOR NEW USERS:
KarjiStore.com offers a wide range of premium products including:
- Designer perfumes and fragrances (Roberto Cavalli, Tom Ford, etc.)
- Luxury accessories and jewelry
- Premium watches and timepieces
- Beauty and personal care products
- Competitive pricing with frequent offers
- Fast shipping across UAE

🚨 CRITICAL INVENTORY RULE - NEVER SUGGEST NON-EXISTENT PRODUCTS 🚨
IMPORTANT: You can ONLY suggest products that actually exist in KarjiStore's inventory. 

❌ ABSOLUTELY FORBIDDEN:
- Never suggest products you don't have (e.g., "we have gaming accessories" when you don't)
- Never mention categories you don't carry (e.g., "we have electronics" when you don't)
- Never suggest alternatives that aren't in your actual inventory

✅ MANDATORY RESPONSE FORMAT:
- If customer asks for something you don't have: "I'm sorry, we don't currently carry [product] in our inventory."
- Only suggest products that are actually available in your store
- Be honest about what you don't have - don't try to be "helpful" by suggesting non-existent alternatives
- Focus on what you DO have: luxury fragrances, premium accessories, watches, and beauty products

ALWAYS match your response to the customer's actual request. If they ask for hand cream, respond about hand cream - not perfumes. If they ask for accessories, respond about accessories - not fragrances. Be category-appropriate in your responses.

SPELLING CORRECTION HANDLING:
The AI model automatically handles spelling corrections. Respond naturally as if the customer typed correctly.

CUSTOMER INTELLIGENCE:
- Customer Type: ${insights.customerType}
- Purchase Probability: ${(insights.purchaseProbability * 100).toFixed(0)}%
- Recommended Approach: ${insights.recommendedApproach}
- Communication Tone: ${recommendations.communicationTone}
- Current Mood: ${profile.emotionalProfile.currentMood}
- Trust Level: ${(profile.emotionalProfile.trustLevel * 100).toFixed(0)}%
- Urgency Level: ${(profile.emotionalProfile.urgencyLevel * 100).toFixed(0)}%
- Is New User: ${conversationService.getMessages(currentSessionId)?.length <= 2 ? 'YES - Needs introduction to store' : 'NO'}

CONVERSATION CONTEXT: ${conversationContext}

CUSTOMER PREFERENCES:
- Preferred Categories: ${recommendations.recommendedCategories?.join(', ') || 'Not established yet'}
- Preferred Brands: ${recommendations.recommendedBrands?.join(', ') || 'Not established yet'}
- Price Range: ${recommendations.recommendedPriceRange?.join(', ') || 'Flexible'}
- Key Features: ${recommendations.recommendedFeatures?.join(', ') || 'General preferences'}

DETECTED OBJECTIONS: ${insights.potentialObjections?.join(', ') || 'None detected'}
MOTIVATIONS: ${insights.motivations?.join(', ') || 'General interest'}

BEHAVIORAL TRIGGERS:
${insights.keyTriggers?.map((trigger: string) => `- ${trigger}`).join('\n') || '- Standard approach'}

${isPurchaseConfirmation ? `
PURCHASE CONFIRMATION MODE:
The customer has confirmed their intent to purchase. DO NOT show new products. Instead:
1. Acknowledge their purchase intent positively
2. Provide helpful purchase assistance (sizes, shipping, payment options)
3. Guide them to the next steps in the purchase process
4. Ask if they need help with anything specific about their chosen product(s)
5. Be supportive and helpful with the transaction process

DO NOT search for or recommend different products at this stage.
` : `
NEW USER ONBOARDING (for first 1-2 messages):
${conversationService.getMessages(currentSessionId)?.length <= 2 ? `
PRIORITY: This appears to be a new user. Follow this enhanced onboarding flow:
1. WARM WELCOME: Greet warmly and briefly introduce KarjiStore's specialization in luxury fragrances
2. IMMEDIATE VALUE: Mention current popular items or special offers to create interest
3. GENTLE DISCOVERY: Ask ONE simple, open-ended question about what they're looking for
4. SMART SUGGESTIONS: Offer 2-3 specific categories they can explore (e.g., "women's fragrances", "men's cologne", "gift sets")
5. EXCEPTION: If user specifically requests products (e.g., "show me men's accessories", "show me watches"), immediately search and display relevant products instead of following onboarding flow

Example approach: "Welcome to KarjiStore! We offer premium fragrances, luxury accessories, watches, and beauty products from top designers. Whether you're looking for something for yourself or as a gift, I'd love to help you find the perfect item. What brings you here today - are you looking for fragrances, accessories, watches, or something else?"
` : ''}

CONVERSATION FLOW LOGIC:
1. PREFERENCE GATHERING PHASE: Ask minimal, focused questions to understand customer needs quickly
2. PRODUCT PRESENTATION PHASE: Show exactly 4 products matching their preferences 
3. SATISFACTION CHECK PHASE: After showing products, ask if they're satisfied or need different options
4. PURCHASE GUIDANCE PHASE: If satisfied, guide them toward purchase decision and provide purchase assistance

EXCEPTION FOR NEW USERS: If a new user makes a specific product request (e.g., "show me men's accessories"), skip preference gathering and immediately show relevant products.

SMART PRODUCT RECOMMENDATIONS:
${context.products.slice(0, 4).map((p: Product) => `- ${p.title} (${p.price || 'N/A'}${p.discountPrice ? `, Sale: ${p.discountPrice}` : ''})`).join('\n')}

CATEGORY-APPROPRIATE RESPONSES:
- For fragrance requests: Use scent-related language (fresh, woody, musky, etc.)
- For beauty/skincare requests: Use skin-related language (moisturizing, hydrating, sensitive skin, etc.)
- For accessory requests: Use style-related language (elegant, classic, modern, etc.)
- For watch requests: Use timepiece-related language (precise, stylish, luxury, etc.)

🚨 CRITICAL PRODUCT DISPLAY RULE - READ CAREFULLY 🚨
When products are being displayed as visual cards, your response MUST follow these strict rules:

❌ ABSOLUTELY FORBIDDEN - NEVER DO THIS:
- Don't write product names: "Gucci Guilty Pour Femme White EDP Women 90ml"
- Don't write prices: "665.00 AED" or "Price: 665 AED" 
- Don't list products: "1. Product A - Description (Price: X)"
- Don't use placeholder text: "[Product cards displayed here]" or "*Visual cards displayed here*"
- Don't describe what the cards show: "each card shows the perfume's name, scent profile, bottle size, and price"
- Don't repeat ANY details that appear on the visual product cards
- NEVER include asterisk descriptions like "*Product cards with details shown below*"

✅ MANDATORY RESPONSE FORMAT:
- Write ONLY conversational guidance: "Here are some perfect options for you"
- Focus on helping the customer: "I've selected these based on your preferences"  
- Be supportive: "These would make excellent choices for what you're looking for"
- Guide their decision: "Take a look at these recommendations"
- End with helpful follow-up: "Let me know if any of these catch your eye or if you'd like different options"

CRITICAL: The visual product cards show ALL product details automatically. Your job is ONLY to provide friendly guidance and context, NEVER to describe or repeat product information.

🚨 COMPARISON REQUESTS - CRITICAL RULES 🚨
When customers ask to compare specific products (e.g., "compare Gucci Flora Jasmine vs Magnolia"):

✅ MANDATORY ACTIONS:
1. Find the EXACT products requested in the comparison
2. Return ONLY those specific products for comparison
3. Set showComparison: true in the response
4. Use proper HTML table format for text comparison
5. NEVER show irrelevant products when comparing specific items

❌ ABSOLUTELY FORBIDDEN:
- Don't show alternative products that weren't requested
- Don't suggest "similar" products during specific comparisons
- Don't mix comparison products with unrelated recommendations

EXAMPLE COMPARISON FORMAT:
"Here's a comparison of the two Gucci Flora Gorgeous fragrances you requested:

<table>
<tr><th>Feature</th><th>Jasmine EDP</th><th>Magnolia EDP</th></tr>
<tr><td>Scent Profile</td><td>Deep, sensual floral with jasmine and amber</td><td>Bright, airy floral with magnolia and citrus</td></tr>
<tr><td>Top Notes</td><td>Light jasmine blossoms</td><td>Crisp magnolia with citrus accents</td></tr>
</table>

I've set up a side-by-side comparison for you to view these products together."

🚨 FOLLOW-UP QUERIES - CLARIFICATION REQUIRED 🚨
When customers use vague follow-up phrases like "show me more", "few more", "another one":

✅ MANDATORY ACTIONS:
1. ALWAYS ask clarifying questions first
2. Reference the previous context: "You were looking at [category/brand] products"
3. Ask specific questions: "Would you like more [category] options, or something different?"
4. NEVER show random products without clarification
5. Wait for user to specify what they want

❌ ABSOLUTELY FORBIDDEN:
- Don't assume what "more" means
- Don't show different product categories without clarification
- Don't lose context from previous queries
- Don't show fragrances when user was looking at watches

EXAMPLE FOLLOW-UP HANDLING:
❌ WRONG: "Here are some more great options!" (shows random products)
✅ CORRECT: "You were looking at men's watches earlier. Would you like to see more watch options, or would you prefer to explore a different category like fragrances or accessories?"
`}

INSTRUCTIONS:
1. ${conversationService.getMessages(currentSessionId)?.length <= 2 ? 'PRIORITY: Follow NEW USER ONBOARDING flow above for smooth introduction, EXCEPT when user specifically requests products - then show products immediately' : 'Follow the conversation flow logic above - don\'t skip phases'}
2. When showing products, ALWAYS present exactly 4 options for optimal choice
3. **🚨 CRITICAL: When showing products, write ONLY conversational guidance text. NEVER list product names, prices, descriptions, or placeholder text like "*Visual cards displayed here*". The visual cards handle all details automatically. Write like: "Here are some great options for you" NEVER like: "1. Product Name - Description (Price: X AED)" or "*Product cards shown below*"**
4. After presenting products, check customer satisfaction before offering more
5. **CATEGORY MATCHING: Always respond appropriately to the customer's request. If they ask for hand cream, respond about hand cream and beauty products. If they ask for accessories, respond about accessories. If they ask for perfumes, respond about fragrances. Never default to perfume responses for non-perfume requests.**
5. If customer indicates satisfaction ("perfect", "these look great", etc.), immediately guide toward purchase
6. Use conversational follow-up suggestions that sound like natural customer responses
7. Address any detected objections proactively
8. Use the appropriate communication tone (${recommendations.communicationTone})
9. Create urgency if urgency level is high (${profile.emotionalProfile.urgencyLevel > 0.7 ? 'YES' : 'NO'})
10. Build trust if trust level is low (${profile.emotionalProfile.trustLevel < 0.5 ? 'YES' : 'NO'})
11. For vague queries like "hi" or "hello", use the store introduction approach to educate and guide users
12. Always explain what makes KarjiStore special (premium brands, competitive prices, fast UAE shipping)

KNOWLEDGE BASE:
${context.documents.slice(0, 2).map((d: Document & { content?: string }) => (d.content || '').substring(0, 200)).join('\n')}

🚨 HONESTY RULE - NEVER HALLUCINATE PRODUCTS 🚨
Remember: You're not just providing information - you're creating a personalized shopping experience that guides this specific customer toward a purchase decision.

CRITICAL: When a customer asks for something you don't have:
1. Be honest: "We don't currently carry [product] in our inventory"
2. Don't try to be "helpful" by suggesting alternatives you don't have
3. Focus on what you DO have: "However, we specialize in luxury fragrances, premium accessories, watches, and beauty products"
4. Ask if they'd like to explore your actual inventory instead

NEVER suggest products, categories, or alternatives that don't exist in KarjiStore's actual inventory.

EXAMPLE OF WHAT NOT TO DO:
❌ Customer: "Do you have game consoles?"
❌ WRONG: "We don't have game consoles, but we do have gaming accessories like headsets and controllers"
✅ CORRECT: "I'm sorry, we don't currently carry game consoles in our inventory. We specialize in luxury fragrances, premium accessories, watches, and beauty products. Would you like to explore our fragrance collection instead?"

CUSTOM INSTRUCTIONS:
${context.documents.filter(d => d.name.toLowerCase().includes('instruction') || d.name.toLowerCase().includes('prompt')).map(d => (d.content || '').substring(0, 500)).join('\n').substring(0, 1000)}`;

      // Estimate token count more accurately (approximately 3.5 chars = 1 token for typical content)
      const estimatedTokens = Math.ceil((systemPrompt.length + message.length) / 3.5);
      console.log('Estimated tokens:', estimatedTokens);
      
      let messages;
      // Use smaller buffer and smarter truncation to avoid losing critical instructions
      if (estimatedTokens > 28000) { // Much lower threshold to prevent truncation issues
        console.warn('System prompt too long, optimizing...');
        
        // Create optimized system prompt by prioritizing core instructions
        const coreSystemPrompt = `You are an advanced AI shopping assistant for KarjiStore.com specializing in premium fragrances and luxury perfumes.

STORE OVERVIEW: KarjiStore offers designer perfumes (Roberto Cavalli, Tom Ford), niche fragrances, gift sets, with competitive pricing and fast UAE shipping.

CUSTOMER INTELLIGENCE:
- Customer Type: ${insights.customerType}
- Purchase Probability: ${(insights.purchaseProbability * 100).toFixed(0)}%
- Is New User: ${conversationService.getMessages(currentSessionId)?.length <= 2 ? 'YES - Needs introduction' : 'NO'}
- Communication Tone: ${recommendations.communicationTone}

${isPurchaseConfirmation ? `
PURCHASE CONFIRMATION MODE: Customer confirmed intent to purchase. DO NOT show new products. Provide purchase assistance only.
` : `
CONVERSATION STRATEGY:
${conversationService.getMessages(currentSessionId)?.length <= 2 ? `
NEW USER PRIORITY: Warmly welcome, introduce store specialization, ask ONE simple question about preferences, offer 2-3 categories to explore. AVOID showing products immediately.
` : `
GENERAL FLOW: 1) Gather preferences through questions 2) Present 4 matching products 3) Check satisfaction 4) Guide to purchase
`}

SMART PRODUCT CONTEXT:
${context.products.slice(0, 3).map((p: any) => `- ${p.title} (${p.price || 'N/A'})`).join('\n')}

INSTRUCTIONS:
1. For general questions like "help me narrow down" or "compare options", ASK clarifying questions rather than showing products
2. Only show products when user gives specific preferences or requests them
3. **CRITICAL PRODUCT DISPLAY RULE: When showing products, write ONLY conversational guidance text. DO NOT list product names, prices, descriptions, or placeholder text - visual cards handle all details.**
4. Use conversational tone: ${recommendations.communicationTone}
5. Build trust and create urgency when appropriate
6. Explain KarjiStore's unique value (premium brands, competitive prices, UAE shipping)
`}

KNOWLEDGE BASE: ${context.documents.slice(0, 1).map((d: Document & { content?: string }) => (d.content || '').substring(0, 300)).join('\n')}`;
        
        console.log('Optimized system prompt length:', coreSystemPrompt.length);
        
        messages = [
          { role: "system", content: coreSystemPrompt },
          { role: "user", content: message }
        ];
      } else {
        messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ];
      }

      console.log('Making OpenRouter API call...');
      const response = await callOpenRouterAPI(messages, config);
      console.log('OpenRouter API response received');
      
      // Handle different response formats and add better error checking
      let baseAssistantMessage = "Sorry, I couldn't process your request.";
      let isErrorResponse = false;
      
      if (response && response.choices && Array.isArray(response.choices) && response.choices.length > 0) {
        baseAssistantMessage = response.choices[0]?.message?.content || baseAssistantMessage;
      } else if (response && response.message) {
        // Handle direct message format
        baseAssistantMessage = response.message;
      } else if (response && typeof response === 'string') {
        // Handle string response format
        baseAssistantMessage = response;
      } else {
        console.error('Unexpected API response format:', JSON.stringify(response, null, 2));
        isErrorResponse = true;
      }
      
      // Check if this is an API error response
      if (response && response.error) {
        isErrorResponse = true;
        baseAssistantMessage = "I'm experiencing some technical difficulties with my AI processing right now. Let me try to help you with what I can find in our product database.";
      }

      // Check if this is a brand listing request
      const brandIntent = intentRecognitionService.analyzeIntent(message, conversationService.getMessages(currentSessionId) || []);
      
      // Handle brand listing requests intelligently
      if (brandIntent.category === 'brandListing') {
        try {
          const ragService = (await import('./services/ragService.js')).ragService;
          
          // Extract category and gender context from the user's message
          const categoryHints = brandIntent.entities?.categories || [];
          
          let brands: string[];
          let responseMessage: string;
          
          if (categoryHints.length > 0) {
            // User asked for brands in a specific category (e.g., "Men's watches")
            const category = categoryHints[0];
            const gender = extractGenderFromMessage(message);
            
            brands = await ragService.getBrandsByCategory(category, gender);
            
            if (brands.length > 0) {
              const categoryName = formatCategoryName(category, gender);
              responseMessage = `Here are the luxury brands we carry for **${categoryName}** at KarjiStore:\n\n**${brands.join(', ')}**\n\nWe offer premium ${categoryName.toLowerCase()} from these renowned designers. Would you like me to show you products from any specific brand?`;
            } else {
              responseMessage = `I apologize, but we currently don't have any brands available for ${formatCategoryName(category, gender)}. We specialize in luxury fragrances, watches, and accessories. Would you like me to show you our available categories instead?`;
            }
          } else {
            // User asked for all brands (general request)
            brands = await ragService.getAllBrands();
            responseMessage = `Here are the luxury brands we carry at KarjiStore:\n\n**${brands.join(', ')}**\n\nWe offer premium fragrances, watches, and accessories from these renowned designers. Would you like me to show you products from any specific brand?`;
          }
          
          if (brands.length > 0) {
            const brandResponse = {
              message: responseMessage,
              products: [], // No products for brand listing
              actions: ['show_brand_products', 'browse_categories'],
              followUpQuestions: ['Which brand interests you most?', 'Would you like to see our latest arrivals?'],
              uiElements: {
                showCarousel: false,
                showFilters: true,
                showComparison: false,
                quickActions: ['Browse by Brand', 'View All Products'],
                urgencyIndicators: [],
                socialProof: []
              },
              personalizedTone: 'informative',
              nextBestActions: ['Explore specific brand', 'Browse categories']
            };
            
            // Send brand response directly
            res.json({ 
              message: brandResponse.message,
              products: brandResponse.products,
              sessionId: currentSessionId,
              uiElements: brandResponse.uiElements,
              followUpQuestions: brandResponse.followUpQuestions,
              actions: brandResponse.actions,
              insights: {
                customerType: 'brand-aware',
                purchaseProbability: 0.7,
                recommendedApproach: 'brand-specific'
              }
            });
            return;
          }
        } catch (error) {
          console.error('Error getting brands:', error);
          // Fall through to normal processing
        }
      }

      // Generate smart response with all intelligence features
      const smartResponse = smartResponseService.generateSmartResponse(
        message,
        currentSessionId,
        conversationService.getMessages(currentSessionId) || [],
        context,
        baseAssistantMessage
      );

      // SMART ERROR HANDLING: If there was an API error, be more intelligent about products
      if (isErrorResponse) {
        // If we have products despite the API error, show them with a helpful message
        if (smartResponse.products && smartResponse.products.length > 0) {
          smartResponse.message = "I'm experiencing some technical difficulties with my AI processing, but I can still help you browse our products! Here are some great options I found:";
        } else {
          // No products found, give a helpful fallback
          smartResponse.message = "I'm experiencing some technical difficulties right now. Let me try to help you with what I can find in our product database.";
        }
      }

      // CRITICAL: Handle case when no products are found gracefully
      if (!smartResponse.products || smartResponse.products.length === 0) {
        // Check if this was a category-specific request
        const intent = intentRecognitionService.analyzeIntent(message, conversationService.getMessages(currentSessionId) || []);
        const categoryHints = intent.entities?.categories || [];
        
        if (categoryHints.length > 0) {
          // Update the message to be more helpful
          smartResponse.message = `I apologize, but we currently don't have ${categoryHints.map((cat: string) => {
            if (cat === 'watch') return 'watches';
            if (cat === 'fragrance') return 'fragrances';
            if (cat === 'accessory') return 'accessories';
            if (cat === 'bath') return 'bath products';
            return cat + 's';
          }).join(' or ')} in our inventory. We specialize in luxury fragrances, watches, and accessories. Would you like me to show you our available categories instead?`;
        }
      }

      // Debug: Log what we're sending to the frontend
      console.log('Routes - Sending to frontend:', {
        message: smartResponse.message?.substring(0, 100) + '...',
        hasProducts: !!smartResponse.products,
        productCount: smartResponse.products?.length || 0,
        firstProduct: smartResponse.products?.[0] ? {
          id: smartResponse.products[0].id,
          title: smartResponse.products[0].title,
          price: smartResponse.products[0].price
        } : 'No products'
      });

      // Add assistant response to conversation history with intelligence
      conversationService.addMessage(
        currentSessionId, 
        'assistant', 
        smartResponse.message, 
        smartResponse.products,
        intent
      );

      res.json({ 
        message: smartResponse.message,
        products: smartResponse.products,
        sessionId: currentSessionId,
        uiElements: smartResponse.uiElements,
        followUpQuestions: smartResponse.followUpQuestions,
        actions: smartResponse.actions,
        insights: {
          customerType: insights.customerType,
          purchaseProbability: insights.purchaseProbability,
          recommendedApproach: insights.recommendedApproach
        }
      });
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({ error: "Failed to process chat message" });
    }
  });

  // Helper function to extract gender from message
  function extractGenderFromMessage(message: string): string | null {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes("men's") || lowerMessage.includes("men") || lowerMessage.includes("male")) {
      return 'men';
    } else if (lowerMessage.includes("women's") || lowerMessage.includes("women") || lowerMessage.includes("ladies") || lowerMessage.includes("female")) {
      return 'women';
    }
    return null;
  }

  // Helper function to format category name
  function formatCategoryName(category: string, gender: string | null): string {
    let categoryName = category;
    
    if (category.toLowerCase().includes('watch')) {
      categoryName = 'Watches';
    } else if (category.toLowerCase().includes('fragrance') || category.toLowerCase().includes('perfume')) {
      categoryName = 'Fragrances';
    } else if (category.toLowerCase().includes('accessory')) {
      categoryName = 'Accessories';
    }
    
    if (gender) {
      categoryName = `${gender.charAt(0).toUpperCase() + gender.slice(1)}'s ${categoryName}`;
    }
    
    return categoryName;
  }

  // Helper function to determine if we should search for products
  function shouldSearchForProducts(intent: any, message: string, conversationHistory: any[]): boolean {
    const lowercaseMessage = message.toLowerCase();
    console.log('shouldSearchForProducts called with:', {
      intent: intent.category,
      message: lowercaseMessage,
      hasOpenTo: lowercaseMessage.includes('open to')
    });
    
    // Always search for deals/discount queries - this is a priority use case
    const isDealQuery = ['deal', 'deals', 'sale', 'discount', 'offer', 'special', 'promo', 'cheap', 'affordable'].some(keyword => 
      lowercaseMessage.includes(keyword));
    
    if (isDealQuery) {
      return true; // Always show products for deal queries
    }
    
    // Never search for products if user is asking for help or clarification (but NOT for openness expressions)
    if (intent.category === 'support' && (
      lowercaseMessage.includes('help me narrow down') ||
      lowercaseMessage.includes('help me choose') ||
      lowercaseMessage.includes('help me decide') ||
      lowercaseMessage.includes('compare options') ||
      lowercaseMessage.includes('i need help')
    ) && !lowercaseMessage.includes('open to')) {
      return false;
    }
    
    // Search for products only if:
    // 1. User has specific preferences (categories, brands, price)
    // 2. User explicitly asks to see products
    // 3. User is in buying mode
    // 4. User is comparing specific products and there are products in history
    
    const hasSpecificPreferences = intent.entities.categories.length > 0 || 
                                  intent.entities.brands.length > 0 || 
                                  intent.entities.priceRange ||
                                  intent.entities.products.length > 0;
    
    const explicitlyAskedForProducts = lowercaseMessage.includes('show me') && 
                                      (lowercaseMessage.includes('perfume') || 
                                       lowercaseMessage.includes('fragrance') ||
                                       lowercaseMessage.includes('cologne') ||
                                       lowercaseMessage.includes('product') ||
                                       lowercaseMessage.includes('accessory') ||
                                       lowercaseMessage.includes('accessories') ||
                                       lowercaseMessage.includes('watch') ||
                                       lowercaseMessage.includes('jewelry') ||
                                       lowercaseMessage.includes('bracelet') ||
                                       lowercaseMessage.includes('floral') ||
                                       lowercaseMessage.includes('wallet'));

    // Specialized fragrance queries should always trigger product search
    const isSpecializedFragranceQuery = lowercaseMessage.includes('oud') || 
                                       lowercaseMessage.includes('bakhoor') ||
                                       lowercaseMessage.includes('agarwood') ||
                                       lowercaseMessage.includes('oriental') ||
                                       lowercaseMessage.includes('amber') ||
                                       lowercaseMessage.includes('sandalwood') ||
                                       lowercaseMessage.includes('incense') ||
                                       lowercaseMessage.includes('attar') ||
                                       lowercaseMessage.includes('floral') ||
                                       lowercaseMessage.includes('flower') ||
                                       lowercaseMessage.includes('jasmine') ||
                                       lowercaseMessage.includes('rose') ||
                                       lowercaseMessage.includes('lily') ||
                                       lowercaseMessage.includes('woody') ||
                                       lowercaseMessage.includes('musky') ||
                                       lowercaseMessage.includes('fresh') ||
                                       lowercaseMessage.includes('citrus');
    
    // Brand-specific queries should always trigger product search
    const isBrandQuery = lowercaseMessage.includes('brand') && intent.entities.brands.length > 0;
    
    const isBuyingIntent = intent.category === 'buying';
    
    const isComparingWithContext = intent.category === 'comparing' && 
                                  conversationHistory.some((msg: any) => 
                                    msg.type === 'assistant' && msg.content?.includes('AED'));

    // User expressing openness or flexibility should see products
    const isOpenToBrowsing = lowercaseMessage.includes('open to') || 
                            lowercaseMessage.includes('flexible') ||
                            lowercaseMessage.includes('anything') ||
                            lowercaseMessage.includes('any option') ||
                            lowercaseMessage.includes('show me') ||
                            lowercaseMessage.includes('what do you have') ||
                            lowercaseMessage.includes('accessory') ||
                            lowercaseMessage.includes('accessories') ||
                            lowercaseMessage.includes('watch') ||
                            lowercaseMessage.includes('jewelry');

    // User has engaged with preferences (this indicates browsing intent after preference questions)
    const hasEngagedWithPreferences = conversationHistory.some((msg: any) => 
      msg.role === 'user' && (
        msg.content?.toLowerCase().includes('woody') ||
        msg.content?.toLowerCase().includes('musky') ||
        msg.content?.toLowerCase().includes('fresh') ||
        msg.content?.toLowerCase().includes('light') ||
        msg.content?.toLowerCase().includes('cologne')
      )
    );
    
    return hasSpecificPreferences || explicitlyAskedForProducts || isBuyingIntent || 
           isComparingWithContext || isOpenToBrowsing || hasEngagedWithPreferences || isBrandQuery || isSpecializedFragranceQuery;
  }

  // Conversation management endpoints
  app.get("/api/conversation/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { limit } = req.query;
      
      const history = conversationService.getConversationHistory(
        sessionId, 
        limit ? parseInt(limit as string) : undefined
      );
      
      res.json({ 
        sessionId, 
        messages: history,
        preferences: conversationService.getUserPreferences(sessionId)
      });
    } catch (error) {
      console.error('Error fetching conversation:', error);
      res.status(500).json({ error: "Failed to fetch conversation history" });
    }
  });

  app.delete("/api/conversation/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      conversationService.clearSession(sessionId);
      res.json({ success: true, message: "Session cleared" });
    } catch (error) {
      console.error('Error clearing session:', error);
      res.status(500).json({ error: "Failed to clear session" });
    }
  });

  app.get("/api/conversation-stats", async (req, res) => {
    try {
      const stats = conversationService.getSessionStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ error: "Failed to get conversation stats" });
    }
  });

  // Documents endpoints
  app.get("/api/documents", async (req, res) => {
    const documents = await storage.getDocuments();
    res.json(documents);
  });

  app.post("/api/documents", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const tempFilePath = req.file.path;
      
      // Store file permanently
      const { fileName, filePath } = await fileStorageService.storeFile(
        tempFilePath,
        req.file.originalname,
        'documents',
        req.file.mimetype
      );

      // Create uploaded file record
      const uploadedFile = await storage.createUploadedFile({
        originalName: req.file.originalname,
        fileName,
        filePath,
        mimeType: req.file.mimetype,
        size: `${(req.file.size / 1024).toFixed(1)} KB`,
        sourceType: 'document',
        processed: false
      });

      // Process document with enhanced document processor
      const processedDocs = await documentProcessor.processFile(
        filePath, 
        req.file.originalname, 
        req.file.mimetype
      );
      
      // Store processed data
      await fileStorageService.storeProcessedData(processedDocs, fileName, 'document');

      // Create document in storage and index it
      const textContent = processedDocs.map(doc => doc.content).join('\n\n');
      // Remove null bytes and other invalid UTF-8 characters that cause database errors
      const cleanContent = textContent.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
      
      const document = await storage.createDocument({
        name: req.file.originalname,
        content: cleanContent,
        type: req.file.mimetype,
        size: `${(req.file.size / 1024).toFixed(1)} KB`,
      });

      // Index document in vector database
      await ragService.indexDocument(document);

      // Mark as processed
      await storage.updateUploadedFile(uploadedFile.id, { processed: true });

      res.json({ document, uploadedFile, processedChunks: processedDocs.length });
    } catch (error) {
      console.error('Document upload error:', error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    const success = await storage.deleteDocument(req.params.id);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Document not found" });
    }
  });

  // Products endpoints
  app.get("/api/products", async (req, res) => {
    const products = await storage.getProducts();
    res.json(products);
  });

  app.get("/api/products/search", async (req, res) => {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }
    
    const products = await storage.searchProducts(q);
    res.json(products);
  });

  app.post("/api/products", async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      await ragService.indexProduct(product);
      res.json(product);
    } catch (error) {
      res.status(400).json({ error: "Invalid product data" });
    }
  });

  // Offers endpoints
  app.get("/api/offers", async (req, res) => {
    const offers = await storage.getOffers();
    res.json(offers);
  });

  app.post("/api/offers", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No Excel file uploaded" });
      }

      // Simple CSV parsing (for demo - in production use proper Excel parser)
      const filePath = req.file.path;
      const content = fs.readFileSync(filePath, 'utf8');
      fs.unlinkSync(filePath);

      const lines = content.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const offers = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length >= 3) {
          const offer = await storage.createOffer({
            productId: values[0],
            discountPrice: values[1],
            offerDesc: values[2],
          });
          offers.push(offer);
        }
      }

      res.json({ offers, count: offers.length });
    } catch (error) {
      console.error('Offers upload error:', error);
      res.status(500).json({ error: "Failed to upload offers" });
    }
  });

  app.delete("/api/offers/:id", async (req, res) => {
    const success = await storage.deleteOffer(req.params.id);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Offer not found" });
    }
  });

  app.delete("/api/offers", async (req, res) => {
    await storage.clearOffers();
    res.json({ success: true });
  });

  // API Config endpoints
  app.get("/api/config", async (req, res) => {
    const config = await storage.getApiConfig();
    if (config) {
      // Don't expose the API key in responses
      const { openrouterKey, ...safeConfig } = config;
      res.json({ ...safeConfig, hasApiKey: !!openrouterKey });
    } else {
      res.json({ hasApiKey: !!process.env.OPENROUTER_API_KEY });
    }
  });

  app.post("/api/config", async (req, res) => {
    try {
      const configData = insertApiConfigSchema.parse(req.body);
      const config = await storage.upsertApiConfig(configData);
      const { openrouterKey, ...safeConfig } = config;
      res.json({ ...safeConfig, hasApiKey: !!openrouterKey });
    } catch (error) {
      res.status(400).json({ error: "Invalid configuration data" });
    }
  });

  app.post("/api/config/test", async (req, res) => {
    try {
      const config = await storage.getApiConfig();
      const apiKey = req.body.apiKey || config?.openrouterKey;
      
      if (!apiKey) {
        return res.status(400).json({ success: false, error: "API key is required" });
      }

      const testMessages = [
        { role: "user", content: "Hello, this is a test message." }
      ];
      
      const testConfig = { ...config, openrouterKey: apiKey };
      const response = await callOpenRouterAPI(testMessages, testConfig);
      res.json({ success: true, response: response.choices[0]?.message?.content });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get OpenRouter models
  app.get("/api/openrouter/models", async (req, res) => {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      const models = data.data.map((model: any) => ({
        value: model.id,
        label: model.name,
        pricing: model.pricing,
        context_length: model.context_length
      }));

      res.json(models);
    } catch (error) {
      console.error('Failed to fetch OpenRouter models:', error);
      // Fallback to popular models if API fails
      const fallbackModels = [
        { value: "openai/gpt-4", label: "GPT-4" },
        { value: "openai/gpt-4-turbo", label: "GPT-4 Turbo" },
        { value: "openai/gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
        { value: "anthropic/claude-3-opus", label: "Claude 3 Opus" },
        { value: "anthropic/claude-3-sonnet", label: "Claude 3 Sonnet" },
        { value: "anthropic/claude-3-haiku", label: "Claude 3 Haiku" },
        { value: "meta-llama/llama-3-70b-instruct", label: "Llama 3 70B" },
        { value: "meta-llama/llama-3-8b-instruct", label: "Llama 3 8B" },
        { value: "mistralai/mixtral-8x7b-instruct", label: "Mixtral 8x7B" },
        { value: "mistralai/mistral-7b-instruct", label: "Mistral 7B" },
        { value: "google/gemini-pro", label: "Gemini Pro" }
      ];
      res.json(fallbackModels);
    }
  });

  // Merchant Feed endpoints
  app.get("/api/merchant-feeds", async (req, res) => {
    const feeds = await storage.getMerchantFeeds();
    res.json(feeds);
  });

  app.post("/api/merchant-feeds", async (req, res) => {
    try {
      const feedData = insertMerchantFeedSchema.parse(req.body);
      const feed = await storage.createMerchantFeed(feedData);
      res.json(feed);
    } catch (error) {
      res.status(400).json({ error: "Invalid feed data" });
    }
  });

  app.post("/api/merchant-feeds/:id/sync", async (req, res) => {
    try {
      const feedRecord = await storage.getMerchantFeeds();
      const feed = feedRecord.find(f => f.id === req.params.id);
      
      if (!feed) {
        return res.status(404).json({ error: "Feed not found" });
      }

      await storage.updateMerchantFeed(req.params.id, {
        lastSynced: new Date(),
        status: 'syncing'
      });

      // Fetch and parse actual XML feed
      const response = await fetch(feed.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.statusText}`);
      }
      
      const xmlData = await response.text();
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(xmlData);

      let products: any[] = [];
      let importedCount = 0;

      // Clear existing products before importing new ones
      await storage.clearProducts();
      await ragService.clearIndex();

      // Parse Google Shopping XML format
      if (result.rss && result.rss.channel && result.rss.channel.item) {
        const items = Array.isArray(result.rss.channel.item) 
          ? result.rss.channel.item 
          : [result.rss.channel.item];

        products = items.map((item: any) => ({
          id: item.guid || item.link || `product-${Date.now()}-${Math.random()}`,
          title: item.title || 'Unnamed Product',
          description: item.description || '',
          price: extractPrice(item['g:price'] || item.price),
          originalPrice: extractPrice(item['g:price'] || item.price),
          availability: item['g:availability'] || 'Unknown',
          imageLink: item['g:image_link'] || item.image || '',
          link: item.link || '',
          brand: item['g:brand'] || '',
          condition: item['g:condition'] || 'new',
          additionalFields: {
            gtin: item['g:gtin'] || '',
            mpn: item['g:mpn'] || '',
            product_type: item['g:product_type'] || '',
            google_product_category: item['g:google_product_category'] || ''
          }
        }));
      }
      // Parse Atom feed format
      else if (result.feed && result.feed.entry) {
        const entries = Array.isArray(result.feed.entry) 
          ? result.feed.entry 
          : [result.feed.entry];

        products = entries.map((entry: any) => ({
          id: entry.id || entry.link?.href || `product-${Date.now()}-${Math.random()}`,
          title: entry.title || 'Unnamed Product',
          description: entry.summary || entry.content || '',
          price: extractPrice(entry['g:price']),
          originalPrice: extractPrice(entry['g:price']),
          availability: entry['g:availability'] || 'Unknown',
          imageLink: entry['g:image_link'] || '',
          link: entry.link?.href || entry.link || '',
          brand: entry['g:brand'] || '',
          condition: entry['g:condition'] || 'new',
          additionalFields: {
            gtin: entry['g:gtin'] || '',
            mpn: entry['g:mpn'] || '',
            product_type: entry['g:product_type'] || '',
            google_product_category: entry['g:google_product_category'] || ''
          }
        }));
      }

      // Store merchant feed data
      await fileStorageService.storeMerchantFeedData(products, req.params.id, feed.url);

      // Store products in database and index them
      for (const productData of products) {
        try {
          const product = await storage.createProduct(productData);
          await ragService.indexProduct(product);
          importedCount++;
        } catch (error) {
          console.log(`Failed to import product ${productData.id}:`, error);
        }
      }

      // Save consolidated product vectors after processing all products
      try {
        const { langchainRAGService } = await import('./services/langchainRAG.js');
        await langchainRAGService.saveAllProductsVector();
        console.log('Consolidated product vectors updated after feed sync');
      } catch (error) {
        console.error('Error saving consolidated vectors:', error);
      }

      await storage.updateMerchantFeed(req.params.id, {
        lastSynced: new Date(),
        status: 'success'
      });

      res.json({ success: true, productsImported: importedCount, totalFound: products.length });
    } catch (error) {
      console.error('Feed sync error:', error);
      await storage.updateMerchantFeed(req.params.id, {
        status: 'error'
      });
      res.status(500).json({ error: `Failed to sync feed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  });

  // Vector Index Management endpoints
  app.post("/api/admin/reindex", async (req, res) => {
    try {
      await ragService.reindexAll();
      res.json({ success: true, message: "Vector index rebuilt successfully" });
    } catch (error) {
      console.error('Reindex error:', error);
      res.status(500).json({ error: "Failed to rebuild index" });
    }
  });

  app.post("/api/admin/clear-index", async (req, res) => {
    try {
      await ragService.clearIndex();
      res.json({ success: true, message: "Vector index cleared successfully" });
    } catch (error) {
      console.error('Clear index error:', error);
      res.status(500).json({ error: "Failed to clear index" });
    }
  });

  // Save consolidated product vectors endpoint
  app.post("/api/admin/save-consolidated-vectors", async (req, res) => {
    try {
      const { langchainRAGService } = await import('./services/langchainRAG.js');
      await langchainRAGService.saveAllProductsVector();
      res.json({ success: true, message: "Consolidated product vectors saved successfully" });
    } catch (error) {
      console.error('Save consolidated vectors error:', error);
      res.status(500).json({ error: "Failed to save consolidated vectors" });
    }
  });

  // Test consolidated search endpoint
  app.post("/api/admin/test-consolidated-search", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: "Query required" });
      }

      const context = await ragService.findRelevantContext(query, {
        maxProducts: 5,
        maxDocuments: 2
      });

      res.json({ 
        success: true, 
        query,
        found: {
          products: context.products.length,
          documents: context.documents.length
        },
        products: context.products.slice(0, 3), // Show first 3 products
        message: `Found ${context.products.length} products and ${context.documents.length} documents using consolidated search`
      });
    } catch (error) {
      console.error('Test consolidated search error:', error);
      res.status(500).json({ error: "Failed to test consolidated search" });
    }
  });

  // Save MemoryVectorStore state endpoint
  app.post("/api/admin/save-vector-store", async (req, res) => {
    try {
      const { langchainRAGService } = await import('./services/langchainRAG.js');
      await langchainRAGService.saveVectorStoreState();
      res.json({ success: true, message: "MemoryVectorStore state saved successfully" });
    } catch (error) {
      console.error('Save vector store error:', error);
      res.status(500).json({ error: "Failed to save vector store state" });
    }
  });

  // Helper function to extract price from various formats
  function extractPrice(priceStr: string): string {
    if (!priceStr) return '';
    // Extract numeric value and currency
    const match = priceStr.match(/([0-9,]+\.?[0-9]*)\s*([A-Z]{3}|[$€£¥])/i);
    if (match) {
      const [, amount, currency] = match;
      if (currency === 'USD' || currency === '$') {
        return `$${amount}`;
      }
      return `${amount} ${currency}`;
    }
    return priceStr;
  }

  // File management endpoints
  app.get("/api/files", async (req, res) => {
    try {
      const { sourceType } = req.query;
      const files = await storage.getUploadedFiles(sourceType as string);
      const stats = fileStorageService.getUploadStats();
      res.json({ files, stats });
    } catch (error) {
      console.error('Error getting files:', error);
      res.status(500).json({ error: "Failed to get files" });
    }
  });

  app.delete("/api/files/:id", async (req, res) => {
    try {
      const files = await storage.getUploadedFiles();
      const targetFile = files.find(f => f.id === req.params.id);
      
      if (!targetFile) {
        return res.status(404).json({ error: "File not found" });
      }

      fileStorageService.deleteFile(targetFile.filePath);
      const success = await storage.deleteUploadedFile(req.params.id);
      // Vector embeddings are automatically managed by ChromaDB
      
      res.json({ success });
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // ChromaDB embeddings management endpoints
  app.get("/api/embeddings/status", async (req, res) => {
    try {
      const { chromaVectorDBService } = await import('./services/chromaVectorDB.js');
      const status = chromaVectorDBService.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Error getting ChromaDB status:', error);
      res.status(500).json({ error: "Failed to get ChromaDB status" });
    }
  });

  app.delete("/api/embeddings", async (req, res) => {
    try {
      await ragService.clearIndex();
      res.json({ success: true, message: "ChromaDB vector index cleared" });
    } catch (error) {
      console.error('Error clearing ChromaDB embeddings:', error);
      res.status(500).json({ error: "Failed to clear ChromaDB embeddings" });
    }
  });

  // User Settings endpoints
  app.get("/api/settings/:sessionId", async (req, res) => {
    try {
      const settings = await storage.getUserSettings(req.params.sessionId);
      if (!settings) {
        // Return default settings if none exist
        const defaultSettings = {
          sessionId: req.params.sessionId,
          theme: "system",
          accentColor: "blue",
          chatStyle: "balanced",
          showProductImages: true,
          showPricing: true,
          autoSuggestions: true,
          communicationTone: "friendly",
          language: "en",
          rememberPreferences: true,
          shareData: true,
          soundEnabled: true,
          notifications: true,
          compactMode: false,
          animationsEnabled: true,
          anonymousMode: false,
        };
        res.json(defaultSettings);
      } else {
        res.json(settings);
      }
    } catch (error) {
      console.error('Error getting user settings:', error);
      res.status(500).json({ error: "Failed to get settings" });
    }
  });

  app.put("/api/settings/:sessionId", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const settingsData = insertUserSettingsSchema.parse(req.body);
      
      const settings = await storage.upsertUserSettings(sessionId, settingsData);
      res.json(settings);
    } catch (error) {
      console.error('Error saving user settings:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid settings data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save settings" });
    }
  });

  app.delete("/api/settings/:sessionId", async (req, res) => {
    try {
      const success = await storage.deleteUserSettings(req.params.sessionId);
      res.json({ success });
    } catch (error) {
      console.error('Error deleting user settings:', error);
      res.status(500).json({ error: "Failed to delete settings" });
    }
  });

  // System status endpoint
  app.get("/api/system/status", async (req, res) => {
    try {
      const stats = fileStorageService.getUploadStats();
      const documentCount = (await storage.getDocuments()).length;
      const productCount = (await storage.getProducts()).length;
      
      const { chromaVectorDBService } = await import('./services/chromaVectorDB.js');
      const chromaStatus = chromaVectorDBService.getStatus();
      
      res.json({
        storage: stats,
        chroma: chromaStatus,
        documents: documentCount,
        products: productCount,
        ragInitialized: ragService.isInitialized
      });
    } catch (error) {
      console.error('Error getting system status:', error);
      res.status(500).json({ error: "Failed to get system status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
