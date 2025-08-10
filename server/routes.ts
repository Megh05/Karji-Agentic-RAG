import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { insertDocumentSchema, insertProductSchema, insertOfferSchema, insertApiConfigSchema, insertMerchantFeedSchema } from "@shared/schema";
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

// Initialize RAG service
ragService.initialize();

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
      max_tokens: config?.maxTokens || 500,
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
        
        if (shouldSearchProducts) {
          // Find relevant context using enhanced RAG with user preferences
          context = await ragService.findRelevantContext(message, {
            maxDocuments: 2,
            maxProducts: 4,
            similarityThreshold: 0.3
          });
        } else {
          // For general questions, only get documents (knowledge base) but not products
          context = await ragService.findRelevantContext(message, {
            maxDocuments: 2,
            maxProducts: 0, // Don't search for products
            similarityThreshold: 0.3
          });
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
KarjiStore.com specializes in premium fragrances and luxury perfumes. We offer:
- Designer perfumes for men and women (Roberto Cavalli, Tom Ford, etc.)
- Niche and luxury fragrances
- Gift sets and special occasions perfumes
- Competitive pricing with frequent offers
- Fast shipping across UAE

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
5. AVOID OVERWHELMING: Don't show products immediately unless specifically requested

Example approach: "Welcome to KarjiStore! We specialize in premium fragrances from top designers like Roberto Cavalli and Tom Ford. Whether you're looking for something for yourself or as a gift, I'd love to help you find the perfect scent. What brings you here today - are you browsing for men's or women's fragrances?"
` : ''}

CONVERSATION FLOW LOGIC:
1. PREFERENCE GATHERING PHASE: Ask minimal, focused questions to understand customer needs quickly
2. PRODUCT PRESENTATION PHASE: Show exactly 4 products matching their preferences 
3. SATISFACTION CHECK PHASE: After showing products, ask if they're satisfied or need different options
4. PURCHASE GUIDANCE PHASE: If satisfied, guide them toward purchase decision and provide purchase assistance

SMART PRODUCT RECOMMENDATIONS:
${context.products.slice(0, 4).map((p: any) => `- ${p.title}: ${(p.description || '').substring(0, 150)} (Price: ${p.price || 'N/A'}${p.discountPrice ? `, Sale: ${p.discountPrice}` : ''}) ${p.availability === 'in_stock' ? '[IN STOCK]' : '[LIMITED]'}`).join('\n')}
`}

INSTRUCTIONS:
1. ${conversationService.getMessages(currentSessionId)?.length <= 2 ? 'PRIORITY: Follow NEW USER ONBOARDING flow above for smooth introduction' : 'Follow the conversation flow logic above - don\'t skip phases'}
2. When showing products, ALWAYS present exactly 4 options for optimal choice
3. After presenting products, check customer satisfaction before offering more
4. If customer indicates satisfaction ("perfect", "these look great", etc.), immediately guide toward purchase
5. Use conversational follow-up suggestions that sound like natural customer responses
6. Address any detected objections proactively
7. Use the appropriate communication tone (${recommendations.communicationTone})
8. Create urgency if urgency level is high (${profile.emotionalProfile.urgencyLevel > 0.7 ? 'YES' : 'NO'})
9. Build trust if trust level is low (${profile.emotionalProfile.trustLevel < 0.5 ? 'YES' : 'NO'})
10. For vague queries like "hi" or "hello", use the store introduction approach to educate and guide users
11. Always explain what makes KarjiStore special (premium brands, competitive prices, fast UAE shipping)

KNOWLEDGE BASE:
${context.documents.slice(0, 2).map((d: any) => (d.content || '').substring(0, 200)).join('\n')}

Remember: You're not just providing information - you're creating a personalized shopping experience that guides this specific customer toward a purchase decision.

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
${context.products.slice(0, 3).map((p: any) => `- ${p.title}: ${(p.description || '').substring(0, 100)} (${p.price || 'N/A'})`).join('\n')}

INSTRUCTIONS:
1. For general questions like "help me narrow down" or "compare options", ASK clarifying questions rather than showing products
2. Only show products when user gives specific preferences or requests them
3. Use conversational tone: ${recommendations.communicationTone}
4. Build trust and create urgency when appropriate
5. Explain KarjiStore's unique value (premium brands, competitive prices, UAE shipping)
`}

KNOWLEDGE BASE: ${context.documents.slice(0, 1).map((d: any) => (d.content || '').substring(0, 300)).join('\n')}`;
        
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
      
      const baseAssistantMessage = response.choices[0]?.message?.content || "Sorry, I couldn't process your request.";

      // Generate smart response with all intelligence features
      const smartResponse = smartResponseService.generateSmartResponse(
        message,
        currentSessionId,
        conversationService.getMessages(currentSessionId) || [],
        context,
        baseAssistantMessage
      );

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

  // Helper function to determine if we should search for products
  function shouldSearchForProducts(intent: any, message: string, conversationHistory: any[]): boolean {
    const lowercaseMessage = message.toLowerCase();
    
    // Always search for deals/discount queries - this is a priority use case
    const isDealQuery = ['deal', 'deals', 'sale', 'discount', 'offer', 'special', 'promo', 'cheap', 'affordable'].some(keyword => 
      lowercaseMessage.includes(keyword));
    
    if (isDealQuery) {
      return true; // Always show products for deal queries
    }
    
    // Never search for products if user is asking for help or clarification
    if (intent.category === 'support' && (
      lowercaseMessage.includes('help me narrow down') ||
      lowercaseMessage.includes('help me choose') ||
      lowercaseMessage.includes('help me decide') ||
      lowercaseMessage.includes('compare options') ||
      lowercaseMessage.includes('i need help')
    )) {
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
                                       lowercaseMessage.includes('product'));
    
    const isBuyingIntent = intent.category === 'buying';
    
    const isComparingWithContext = intent.category === 'comparing' && 
                                  conversationHistory.some((msg: any) => 
                                    msg.type === 'assistant' && msg.content?.includes('AED'));
    
    return hasSpecificPreferences || explicitlyAskedForProducts || isBuyingIntent || isComparingWithContext;
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
