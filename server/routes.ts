import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { insertDocumentSchema, insertProductSchema, insertOfferSchema, insertApiConfigSchema, insertMerchantFeedSchema } from "@shared/schema";
import { ragService } from "./services/ragService.js";
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
  
  // Chat endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const config = await storage.getApiConfig();
      console.log('Chat config check:', { hasApiKey: !!config?.openrouterKey, selectedModel: config?.selectedModel });
      
      if (!config?.openrouterKey && !process.env.OPENROUTER_API_KEY) {
        return res.status(400).json({ error: "OpenRouter API key not configured" });
      }

      // Find relevant context using enhanced RAG
      const context = await ragService.findRelevantContext(message);
      
      // Create system prompt with context
      const systemPrompt = `You are a helpful and persuasive shopping assistant for KarjiStore.com, an online store with thousands of products, including many discounted offers. Your goal is to engage customers naturally and assist them in finding products they want while encouraging purchases, especially highlighting discounts and special offers.

Use the context provided from product data, offers, and knowledge base documents to answer user queries accurately and helpfully.

When recommending products:
- Prioritize items that are currently discounted or have special offers.
- Present products clearly with their name, short description, discount or price if available.
- Encourage users to explore and buy these products.
- If multiple relevant products are available, mention the top 2-3 best matches.
- Format product recommendations as natural part of your conversation.
- If product cards are supported in the UI, provide data to render cards with product name, short description, image URL, and product page URL.

Always keep your tone friendly, professional, and conversational. Avoid sounding robotic or overly salesy. Answer questions fully but concisely.

If you do not have relevant information in context, politely let the user know and offer general assistance or ask clarifying questions.

Remember: your main objective is to help users find and buy products at KarjiStore.com while providing an excellent chat experience.

AVAILABLE PRODUCT CONTEXT:
${context.products.map(p => `- ${p.title}: ${p.description || ''} (Price: ${p.price || 'N/A'}${p.discountPrice ? `, Discounted: ${p.discountPrice}` : ''}) [Link: ${p.link || 'N/A'}]`).join('\n')}

KNOWLEDGE BASE CONTEXT:
${context.documents.map(d => d.content.substring(0, 500)).join('\n')}

CUSTOM INSTRUCTIONS:
${context.documents.filter(d => d.name.toLowerCase().includes('instruction') || d.name.toLowerCase().includes('prompt')).map(d => d.content).join('\n')}`;

      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ];

      console.log('Making OpenRouter API call...');
      const response = await callOpenRouterAPI(messages, config);
      console.log('OpenRouter API response received');
      
      res.json({
        message: response.choices[0]?.message?.content || "Sorry, I couldn't process your request.",
        products: context.products.slice(0, 3) // Return top 3 relevant products
      });
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({ error: "Failed to process chat message" });
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
