import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDocumentSchema, insertProductSchema, insertOfferSchema, insertApiConfigSchema, insertMerchantFeedSchema } from "@shared/schema";
import multer from "multer";
import fs from "fs";
import path from "path";
import { z } from "zod";
import xml2js from "xml2js";

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Basic text similarity function
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  const intersection = words1.filter(word => words2.includes(word));
  const union = Array.from(new Set([...words1, ...words2]));
  
  return intersection.length / union.length;
}

// RAG function to find relevant context
async function findRelevantContext(query: string): Promise<{ documents: any[], products: any[] }> {
  const documents = await storage.getDocuments();
  const products = await storage.getProducts();
  
  const relevantDocs = documents
    .map(doc => ({ 
      ...doc, 
      similarity: calculateSimilarity(query, doc.content) 
    }))
    .filter(doc => doc.similarity > 0.1)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);

  const relevantProducts = products
    .map(product => ({ 
      ...product, 
      similarity: calculateSimilarity(query, `${product.title} ${product.description || ''}`) 
    }))
    .filter(product => product.similarity > 0.1)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  return { documents: relevantDocs, products: relevantProducts };
}

// OpenRouter API call
async function callOpenRouterAPI(messages: any[], config: any) {
  const apiKey = process.env.OPENROUTER_API_KEY || config.openrouterKey;
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.selectedModel || 'mistralai/mixtral-8x7b-instruct',
      messages,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
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
      if (!config?.openrouterKey && !process.env.OPENROUTER_API_KEY) {
        return res.status(400).json({ error: "OpenRouter API key not configured" });
      }

      // Find relevant context using RAG
      const context = await findRelevantContext(message);
      
      // Create system prompt with context
      const systemPrompt = `You are a helpful sales assistant for KarjiStore.com. 
        You should encourage customers to buy products, especially discounted items.
        
        Available product context:
        ${context.products.map(p => `- ${p.title}: ${p.description || ''} (Price: ${p.price})`).join('\n')}
        
        Knowledge base context:
        ${context.documents.map(d => d.content.substring(0, 500)).join('\n')}
        
        Be helpful, friendly, and sales-oriented. If you recommend products, include their details.`;

      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ];

      const response = await callOpenRouterAPI(messages, config);
      
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

      const filePath = req.file.path;
      const content = fs.readFileSync(filePath, 'utf8');
      fs.unlinkSync(filePath); // Clean up uploaded file

      const document = await storage.createDocument({
        name: req.file.originalname,
        content,
        type: req.file.mimetype,
        size: `${(req.file.size / 1024).toFixed(1)} KB`,
      });

      res.json(document);
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
      const testMessages = [
        { role: "user", content: "Hello, this is a test message." }
      ];
      
      const response = await callOpenRouterAPI(testMessages, config);
      res.json({ success: true, response: response.choices[0]?.message?.content });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
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

      // Store products in database
      for (const productData of products) {
        try {
          await storage.createProduct(productData);
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

  const httpServer = createServer(app);
  return httpServer;
}
