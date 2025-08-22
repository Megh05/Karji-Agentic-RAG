import { langchainRAGService } from './langchainRAG.js';
import { chromaVectorDBService as vectorDBService, VectorDocument } from './chromaVectorDB.js';
import { embeddingService } from './embedding.js';
import { documentProcessor } from './documentProcessor.js';
import { fileStorageService } from './fileStorage.js';
import { storage } from '../storage.js';
import type { Document, Product } from '@shared/schema';

export interface RAGContext {
  documents: Array<Document & { similarity?: number; content: string }>;
  products: Array<Product & { similarity?: number }>;
  relevantChunks: VectorDocument[];
}

export class RAGService {
  private static instance: RAGService;
  public isInitialized = false;

  private constructor() {}

  public static getInstance(): RAGService {
    if (!RAGService.instance) {
      RAGService.instance = new RAGService();
    }
    return RAGService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing RAG service...');
      
      // Initialize Langchain RAG service (includes ChromaDB and embeddings)
      await langchainRAGService.initialize();
      
      // Also initialize vector database and embedding service for fallback
      await vectorDBService.initialize();
      await embeddingService.initialize();
      
      this.isInitialized = true;
      console.log('RAG service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize RAG service:', error);
      // Don't throw error, allow fallback to basic similarity
      this.isInitialized = true;
    }
  }

  public async indexDocument(document: Document): Promise<void> {
    if (!this.isInitialized) await this.initialize();

    try {
      // Process document using Langchain RAG service
      await langchainRAGService.processDocument(document.content, {
        id: document.id,
        name: document.name,
        type: document.type,
        size: document.size,
        uploadedAt: document.uploadedAt instanceof Date ? document.uploadedAt.toISOString() : document.uploadedAt,
        sourceType: 'document'
      });

      console.log(`Indexed document using Langchain RAG: ${document.name}`);
    } catch (error) {
      console.error('Error indexing document:', error);
    }
  }

  public async indexProduct(product: Product): Promise<void> {
    if (!this.isInitialized) await this.initialize();

    try {
      // Process product using Langchain RAG service
      await langchainRAGService.processProduct(product);

      console.log(`Indexed product using Langchain RAG: ${product.title}`);
    } catch (error) {
      console.error('Error indexing product:', error);
    }
  }

  public async indexAllDocuments(): Promise<void> {
    const documents = await storage.getDocuments();
    for (const document of documents) {
      await this.indexDocument(document);
    }
  }

  public async indexAllProducts(): Promise<void> {
    const products = await storage.getProducts();
    for (const product of products) {
      await this.indexProduct(product);
    }
  }

  /**
   * Extract all unique brands from the product database
   * This is useful for brand listing requests
   */
  public async getAllBrands(): Promise<string[]> {
    try {
      const products = await storage.getProducts();
      const brands = new Set<string>();
      
      products.forEach(product => {
        if (product.brand && product.brand.trim()) {
          brands.add(product.brand.trim());
        }
      });
      
      // Sort brands alphabetically for better presentation
      return Array.from(brands).sort();
    } catch (error) {
      console.error('Error extracting brands:', error);
      return [];
    }
  }

  /**
   * Extract brands filtered by specific category and gender
   * This provides intelligent, context-aware brand listing
   */
  public async getBrandsByCategory(category: string, gender?: string | null): Promise<string[]> {
    try {
      const products = await storage.getProducts();
      const brands = new Set<string>();
      
      products.forEach(product => {
        if (!product.brand || !product.brand.trim()) return;
        
        const productType = (product as any).additionalFields?.product_type || '';
        const productTitle = product.title.toLowerCase();
        const productDesc = (product.description || '').toLowerCase();
        
        // Check if product matches the requested category
        let categoryMatch = false;
        let genderMatch = true; // Default to true if no gender specified
        
        // Category matching logic
        if (category.toLowerCase().includes('watch')) {
          categoryMatch = productType.toLowerCase().includes('watch') || 
                         productTitle.includes('watch') || 
                         productDesc.includes('watch');
        } else if (category.toLowerCase().includes('fragrance') || category.toLowerCase().includes('perfume')) {
          categoryMatch = productType.toLowerCase().includes('fragrance') || 
                         productType.toLowerCase().includes('perfume') ||
                         productTitle.includes('edp') || 
                         productTitle.includes('edt') ||
                         productDesc.includes('fragrance') ||
                         productDesc.includes('perfume');
        } else if (category.toLowerCase().includes('accessory')) {
          categoryMatch = productType.toLowerCase().includes('accessory') || 
                         productType.toLowerCase().includes('jewelry') ||
                         productTitle.includes('bracelet') || 
                         productTitle.includes('necklace') ||
                         productTitle.includes('ring') ||
                         productTitle.includes('wallet');
        }
        
        // Gender matching logic
        if (gender) {
          if (gender.toLowerCase() === 'men' || gender.toLowerCase() === 'male') {
            genderMatch = productType.toLowerCase().includes('men') || 
                         productType.toLowerCase().includes('male') ||
                         productTitle.includes('men') || 
                         productTitle.includes('male') ||
                         productDesc.includes('men') ||
                         productDesc.includes('male');
          } else if (gender.toLowerCase() === 'women' || gender.toLowerCase() === 'female') {
            genderMatch = productType.toLowerCase().includes('women') || 
                         productType.toLowerCase().includes('female') ||
                         productTitle.includes('women') || 
                         productTitle.includes('ladies') ||
                         productDesc.includes('women') ||
                         productDesc.includes('ladies');
          }
        }
        
        // Only add brand if both category and gender match
        if (categoryMatch && genderMatch) {
          brands.add(product.brand.trim());
        }
      });
      
      return Array.from(brands).sort();
    } catch (error) {
      console.error('Error extracting brands by category:', error);
      return [];
    }
  }

  public async findRelevantContext(query: string, options?: {
    maxDocuments?: number;
    maxProducts?: number;
    similarityThreshold?: number;
  }, conversationHistory: any[] = []): Promise<RAGContext> {
    if (!this.isInitialized) await this.initialize();

    const { 
      maxDocuments = 3, 
      maxProducts = 4, 
      similarityThreshold = 0.1 
    } = options || {};

    try {
      // Primary: Use Langchain RAG service for semantic similarity search
      const langchainResults = await langchainRAGService.getRelevantContext(query, {
        maxDocuments,
        maxProducts
      });

      if (langchainResults.documents.length > 0 || langchainResults.products.length > 0) {
        console.log(`Langchain RAG found ${langchainResults.documents.length} documents and ${langchainResults.products.length} products`);
        
        // Convert Langchain Document format to our format
        const documents = langchainResults.documents.map(doc => ({
          id: doc.metadata.id || doc.metadata.parentId || 'unknown',
          name: doc.metadata.name || 'Document',
          content: doc.pageContent,
          type: doc.metadata.type || 'document',
          size: doc.metadata.size || 'Unknown',
          uploadedAt: doc.metadata.uploadedAt,
          similarity: 0.9 // High confidence for semantic matches
        }));

        // Get products through intelligent search
        const consolidatedProducts = await this.searchConsolidatedProducts(query, maxProducts, conversationHistory);

        return {
          documents,
          products: consolidatedProducts,
          relevantChunks: []
        };
      }

      // Secondary: Use vector search if available
      const [vectorDocs, vectorProducts] = await Promise.all([
        vectorDBService.searchDocuments(query, maxDocuments),
        vectorDBService.searchProducts(query, maxProducts)
      ]);

      if (vectorDocs.length > 0 || vectorProducts.length > 0) {
        console.log(`Vector search found ${vectorDocs.length} documents and ${vectorProducts.length} products`);
        
        // Get full document and product data
        const documents = await storage.getDocuments();

        const relevantDocs = documents.filter(doc => 
          vectorDocs.some(vDoc => vDoc.id === doc.id)
        ).map(doc => ({ ...doc, similarity: 0.8 }));

        const consolidatedProducts = await this.searchConsolidatedProducts(query, maxProducts, conversationHistory);

        return {
          documents: relevantDocs,
          products: consolidatedProducts,
          relevantChunks: [...vectorDocs, ...vectorProducts]
        };
      }

      // Fallback: Use basic similarity with lower threshold for better coverage
      console.log('Falling back to basic text similarity search');
      return this.basicSimilaritySearch(query, Math.max(similarityThreshold, 0.01), maxDocuments, maxProducts, conversationHistory);

    } catch (error) {
      console.error('Error in document search, falling back to basic similarity:', error);
      return this.basicSimilaritySearch(query, Math.max(similarityThreshold, 0.01), maxDocuments, maxProducts, conversationHistory);
    }
  }

  private async searchConsolidatedProducts(query: string, maxProducts: number, conversationHistory: any[] = []): Promise<any[]> {
    try {
      const { langchainRAGService } = await import('./langchainRAG.js');
      const consolidatedProducts = await langchainRAGService.loadConsolidatedProducts();
      
      if (consolidatedProducts.length === 0) {
        console.log('No consolidated products found, falling back to intelligent product search');
        const allProducts = await storage.getProducts();
        console.log(`RAG Service: Loaded ${allProducts.length} products from JSON storage for intelligent search`);
        if (allProducts.length > 0) {
          console.log(`First product sample: ${allProducts[0].title} (${(allProducts[0] as any).additionalFields?.product_type})`);
        }
        // Search products based on title, description, and product_type  
        console.log(`Calling searchProductsIntelligently with maxProducts=${maxProducts}`);
        const relevantProducts = await this.searchProductsIntelligently(query, allProducts, maxProducts, conversationHistory);
        return relevantProducts;
      }

      console.log(`Searching ${consolidatedProducts.length} consolidated products intelligently`);
      
      // Use intelligent search on consolidated products
      console.log(`Calling searchProductsIntelligently with consolidatedProducts, maxProducts=${maxProducts}`);
      const relevantProducts = await this.searchProductsIntelligently(query, consolidatedProducts, maxProducts, conversationHistory);
      
      console.log(`Found ${relevantProducts.length} products from consolidated file`);
      return relevantProducts;
    } catch (error) {
      console.error('Error searching consolidated products:', error);
      return [];
    }
  }

  private async basicSimilaritySearch(
    query: string, 
    threshold: number, 
    maxDocs: number, 
    maxProducts: number,
    conversationHistory: any[] = []
  ): Promise<RAGContext> {
    const documents = await storage.getDocuments();
    
    // Use consolidated product file for product search with strict limits
    const products = await this.searchConsolidatedProducts(query, maxProducts, conversationHistory);

    const relevantDocs = documents
      .map(doc => ({ 
        ...doc, 
        similarity: this.calculateBasicSimilarity(query, doc.content) 
      }))
      .filter(doc => doc.similarity > threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxDocs);

    return {
      documents: relevantDocs,
      products: products,
      relevantChunks: []
    };
  }

  private calculateBasicSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = Array.from(new Set([...words1, ...words2]));
    
    return intersection.length / union.length;
  }

  private parseUserIntent(query: string, conversationHistory?: any[]): {
    searchTerms: string[];
    priceFilter: { min?: number; max?: number } | null;
    categoryHints: string[];
    brandPreferences: string[];
    qualityLevel: 'budget' | 'mid-range' | 'luxury' | null;
    genderContext: 'men' | 'women' | 'unisex' | null;
    ageContext: 'young' | 'adult' | 'mature' | 'elderly' | null;
    categoryContext: string | null;
  } {
    const queryLower = query.toLowerCase();
    
    // CRITICAL: Define commonWords at the top before using it
    const commonWords = ['do', 'you', 'have', 'are', 'is', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'show', 'me', 'products', 'watches', 'fragrances', 'perfumes', 'accessories'];
    
    // Enhanced category detection
    const categoryHints: string[] = [];
    
    // Check for specific product categories with better precision
    if (queryLower.includes('watch') || queryLower.includes('watches')) {
      categoryHints.push('watch');
    }
    if (queryLower.includes('fragrance') || queryLower.includes('fragrances') || 
        queryLower.includes('perfume') || queryLower.includes('perfumes') ||
        queryLower.includes('cologne') || queryLower.includes('colognes')) {
      categoryHints.push('fragrance');
    }
    if (queryLower.includes('accessory') || queryLower.includes('accessories') ||
        queryLower.includes('jewelry') || queryLower.includes('jewellery')) {
      categoryHints.push('accessory');
    }
    if (queryLower.includes('bath') || queryLower.includes('soap') || queryLower.includes('soaps') ||
        queryLower.includes('body wash') || queryLower.includes('shower gel')) {
      categoryHints.push('bath');
    }
    // CRITICAL: Add tech/electronics categories that we DON'T sell
    if (queryLower.includes('iphone') || queryLower.includes('iphones') || 
        queryLower.includes('phone') || queryLower.includes('phones') ||
        queryLower.includes('smartphone') || queryLower.includes('smartphones') ||
        queryLower.includes('mobile') || queryLower.includes('mobiles') ||
        queryLower.includes('laptop') || queryLower.includes('laptops') ||
        queryLower.includes('computer') || queryLower.includes('computers') ||
        queryLower.includes('tablet') || queryLower.includes('tablets') ||
        queryLower.includes('electronics') || queryLower.includes('electronic')) {
      categoryHints.push('electronics');
    }
    
    console.log('Category detection debug:', {
      originalQuery: query,
      detectedCategories: categoryHints,
      queryLower: queryLower
    });
    
    // Brand detection will be handled later in the method
    
    // Extract conversational context from history
    const conversationContext = this.extractConversationContext(conversationHistory || []);
    
    // Extract price information using intelligent parsing
    let priceFilter: { min?: number; max?: number } | null = null;
    
    // Find all numbers in the query
    const numbers = query.match(/\d+/g)?.map(n => parseInt(n)) || [];
    
    // Price filter patterns - intelligent approach with fuzzy matching
    const priceKeywords = ['aed', 'dirham', 'price', 'cost', 'budget'];
    const rangeKeywords = ['range', 'between', 'from', 'to', 'and'];
    const limitKeywords = ['under', 'below', 'less', 'maximum', 'max', 'up to'];
    
    // Fuzzy matching for common typos and variations
    const fuzzyMatchKeyword = (word: string, keywords: string[], maxDistance: number = 2): boolean => {
      return keywords.some(keyword => {
        const distance = this.levenshteinDistance(word.toLowerCase(), keyword.toLowerCase());
        return distance <= maxDistance;
      });
    };
    
    // Check for price, range, and limit context with fuzzy matching
    const words = queryLower.split(/\s+/);
    const hasPriceContext = words.some(word => 
      priceKeywords.includes(word) || fuzzyMatchKeyword(word, priceKeywords)
    );
    const hasRangeContext = words.some(word => 
      rangeKeywords.includes(word) || fuzzyMatchKeyword(word, rangeKeywords) || queryLower.includes('-')
    );
    const hasLimitContext = words.some(word => 
      limitKeywords.includes(word) || fuzzyMatchKeyword(word, limitKeywords)
    );
    
    // Special handling for dash-separated ranges (e.g., "300-500")
    const dashRangeMatch = query.match(/(\d+)\s*-\s*(\d+)/);
    if (dashRangeMatch && (hasPriceContext || hasRangeContext)) {
      const num1 = parseInt(dashRangeMatch[1]);
      const num2 = parseInt(dashRangeMatch[2]);
      priceFilter = { min: Math.min(num1, num2), max: Math.max(num1, num2) };
    } else if (hasPriceContext && numbers.length > 0) {
      if (hasRangeContext && numbers.length >= 2) {
        // Range query: use first two numbers as min and max
        priceFilter = { min: Math.min(numbers[0], numbers[1]), max: Math.max(numbers[0], numbers[1]) };
      } else if (hasLimitContext && numbers.length >= 1) {
        // Upper limit query: use first number as max
        priceFilter = { max: numbers[0] };
      } else if (numbers.length === 1) {
        // Single number with price context - assume it's a max limit
        priceFilter = { max: numbers[0] };
      }
    }
    
    // Extract category hints with semantic understanding
    const categoryKeywords = [
      'perfume', 'fragrance', 'cologne', 'scent', 'eau', 'edp', 'edt',
      'watch', 'timepiece', 'clock', 'chronograph',
      'jewelry', 'necklace', 'ring', 'bracelet', 'earring', 'chain',
      'wallet', 'bag', 'accessory', 'leather',
      'men', 'women', 'unisex', 'male', 'female', 'mens', 'womens', 'mans', 'womans',
      'luxury', 'premium', 'designer', 'elegant', 'sophisticated',
      'gift', 'present', 'special', 'occasion',
      // Bath and body care products
      'bath', 'soap', 'soaps', 'body wash', 'shower gel', 'bath gel', 'bath salts',
      'bath bomb', 'bubble bath', 'body scrub', 'exfoliant',
      // Tech/Electronics (that we DON'T sell)
      'iphone', 'iphones', 'phone', 'phones', 'smartphone', 'smartphones',
      'mobile', 'mobiles', 'laptop', 'laptops', 'computer', 'computers',
      'tablet', 'tablets', 'electronics', 'electronic',
      // Fragrance note types - CRITICAL for aquatic detection
      'aquatic', 'marine', 'ocean', 'sea', 'fresh', 'water', 'blue', 'breeze',
      'floral', 'citrus', 'woody', 'musky', 'oriental', 'spicy', 'fruity', 'green',
      'light', 'fresh', 'clean', 'airy', 'crisp', 'refreshing',
      // Oud and incense related terms
      'oud', 'agarwood', 'incense', 'sandalwood', 'amber', 'resin', 'smoky',
      'bakhoor', 'attar', 'arabic', 'middle eastern', 'traditional'
    ];
    
    // Add semantic understanding for vague terms and specific requests
    const vaguePhrases = {
      'something nice': ['luxury', 'premium', 'elegant'],
      'good quality': ['premium', 'luxury'],
      'affordable': ['budget', 'cheap', 'inexpensive'],
      'expensive': ['luxury', 'premium', 'designer'],
      'incense sticks': ['oud', 'incense', 'fragrance', 'oriental'], // Map incense requests to oud fragrances
      'oud incense': ['oud', 'oriental', 'woody', 'amber'], // Semantic expansion for oud requests
      'traditional fragrance': ['oud', 'oriental', 'arabic', 'amber'],
      'arabic perfume': ['oud', 'oriental', 'amber', 'sandalwood']
    };
    
    // Check for vague phrases and expand them
    Object.entries(vaguePhrases).forEach(([phrase, expansions]) => {
      if (queryLower.includes(phrase)) {
        categoryKeywords.push(...expansions);
      }
    });
    
    const categoryHintsFromKeywords = categoryKeywords.filter(keyword => 
      queryLower.includes(keyword) || queryLower.includes(keyword + 's')
    );
    
    // Combine category hints from keywords and intelligent parsing
    categoryHints.push(...categoryHintsFromKeywords);

    // Extract meaningful search terms (excluding price and range keywords)
    const excludeWords = [...priceKeywords, ...rangeKeywords, ...limitKeywords, 'show', 'me', 'find', 'get', 'i', 'want', 'need'];
    const searchTerms = queryLower
      .split(/\s+/)
      .filter(word => 
        word.length > 2 && 
        !excludeWords.includes(word) && 
        !numbers.includes(parseInt(word))
      );
    
    // Enhanced brand detection for broader brand queries
    const commonBrands = [
      'tom ford', 'michael kors', 'calvin klein', 'roberto cavalli', 'dunhill', 'lencia',
      'fabian', 'police', 'cerruti', 'boadicea', 'nasamat', 'zenology', 'hugo boss',
      'emporio armani', 'giorgio armani', 'versace', 'gucci', 'prada', 'dior', 'chanel',
      'dolce gabanna', 'jean paul gaultier', 'yves saint laurent', 'cartier', 'elie saab'
    ];
    
    // Enhanced brand detection with better pattern matching
    const brandPreferences: string[] = [];
    
    // Check for exact brand matches first
    commonBrands.forEach(brand => {
      if (queryLower.includes(brand.toLowerCase())) {
        brandPreferences.push(brand);
      }
    });
    
    // Check for brand mentions in context (e.g., "show me products of chanel brand")
    if (queryLower.includes('brand') || queryLower.includes('brands')) {
      commonBrands.forEach(brand => {
        // Look for patterns like "chanel brand", "brand chanel", "products of chanel"
        const brandPatterns = [
          `${brand.toLowerCase()} brand`,
          `brand ${brand.toLowerCase()}`,
          `products of ${brand.toLowerCase()}`,
          `show me ${brand.toLowerCase()}`,
          `do you have ${brand.toLowerCase()}`,
          `have ${brand.toLowerCase()}`
        ];
        
        if (brandPatterns.some(pattern => queryLower.includes(pattern))) {
          if (!brandPreferences.includes(brand)) {
            brandPreferences.push(brand);
            console.log(`Brand pattern match: "${brand}" via pattern matching`);
          }
        }
      });
    }
    
    // If still no brands found, try fuzzy matching for common misspellings
    if (brandPreferences.length === 0) {
      const queryWords = queryLower.split(/\s+/);
      console.log('Fuzzy brand matching debug:', {
        queryWords,
        commonWords,
        willCheckWords: queryWords.filter(word => word.length > 2 && !commonWords.includes(word))
      });
      
      queryWords.forEach(word => {
        // CRITICAL: Skip common words before fuzzy matching
        if (word.length > 2 && !commonWords.includes(word)) { // Only check words longer than 2 characters AND not in common words
          console.log(`Checking word "${word}" for fuzzy brand matching`);
          commonBrands.forEach(brand => {
            const brandWords = brand.toLowerCase().split(/\s+/);
            brandWords.forEach(brandWord => {
              if (this.levenshteinDistance(word, brandWord) <= 1) {
                if (!brandPreferences.includes(brand)) {
                  brandPreferences.push(brand);
                  console.log(`Fuzzy brand match: "${word}" -> "${brand}"`);
                }
              }
            });
          });
        } else {
          console.log(`Skipping word "${word}" - length: ${word.length}, in commonWords: ${commonWords.includes(word)}`);
        }
      });
    }
    
    // Filter out any brands that were incorrectly detected
    const filteredBrandPreferences = brandPreferences.filter(brand => {
      // Additional safety check: don't allow common words to be detected as brands
      const brandLower = brand.toLowerCase();
      return !commonWords.includes(brandLower);
    });
    
    console.log('Brand detection debug:', {
      originalQuery: query,
      detectedBrands: brandPreferences,
      filteredBrands: filteredBrandPreferences,
      commonWordsFiltered: commonWords.filter(word => brandPreferences.includes(word))
    });
    
    // Determine quality/price level based on context
    let qualityLevel: 'budget' | 'mid-range' | 'luxury' | null = null;
    
    const budgetTerms = ['cheap', 'affordable', 'budget', 'inexpensive', 'low cost'];
    const luxuryTerms = ['luxury', 'premium', 'expensive', 'high-end', 'designer', 'exclusive'];
    const midRangeTerms = ['decent', 'good quality', 'reasonable', 'moderate'];
    
    if (budgetTerms.some(term => queryLower.includes(term))) {
      qualityLevel = 'budget';
      if (!priceFilter) priceFilter = { max: 300 }; // Auto-suggest budget range
    } else if (luxuryTerms.some(term => queryLower.includes(term))) {
      qualityLevel = 'luxury';
      if (!priceFilter) priceFilter = { min: 1000 }; // Auto-suggest luxury range
    } else if (midRangeTerms.some(term => queryLower.includes(term))) {
      qualityLevel = 'mid-range';
      if (!priceFilter) priceFilter = { min: 300, max: 1000 }; // Auto-suggest mid-range
    }
    
    // Intelligent gender detection using context and semantic understanding
    const genderContext = this.intelligentGenderDetection(query, conversationContext);
    
    // Intelligent age detection using context and semantic understanding
    const ageContext = this.intelligentAgeDetection(query, conversationContext);
    
    // Category context from conversation (e.g., if user was looking at watches)
    const categoryContext = conversationContext.lastCategory || this.detectCategoryContext(query);
    
    // CRITICAL FIX: Clear irrelevant context when user asks for a different category
    if (categoryHints.length > 0) {
      // User is asking for a specific category, don't use old context
      console.log('User requested specific category, clearing old context:', {
        requestedCategory: categoryHints,
        oldContext: conversationContext.lastCategory
      });
    } else if (queryLower.includes('only') && genderContext && conversationContext.lastCategory) {
      // Only preserve context if user doesn't specify a new category
      categoryHints.push(conversationContext.lastCategory);
    }
    
    console.log('Intent parsing result:', {
      query,
      genderContext,
      ageContext,
      categoryContext,
      conversationContext,
      priceFilter,
      categoryHints
    });
    
    return { 
      searchTerms, 
      priceFilter, 
      categoryHints, 
      brandPreferences, 
      qualityLevel,
      genderContext,
      ageContext,
      categoryContext
    };
  }

  // Extract conversational context from message history
  private extractConversationContext(history: any[]): {
    lastCategory: string | null;
    lastGender: 'men' | 'women' | 'unisex' | null;
    lastAge: 'young' | 'adult' | 'mature' | 'elderly' | null;
    lastBudget: { min?: number; max?: number } | null;
    giftRecipient: 'husband' | 'wife' | 'self' | null;
  } {
    let lastCategory: string | null = null;
    let lastGender: 'men' | 'women' | 'unisex' | null = null;
    let lastAge: 'young' | 'adult' | 'mature' | 'elderly' | null = null;
    let lastBudget: { min?: number; max?: number } | null = null;
    let giftRecipient: 'husband' | 'wife' | 'self' | null = null;

    // Analyze recent messages for context
    const recentMessages = history.slice(-6); // Look at last 6 messages for context
    
    for (const message of recentMessages) {
      const content = message.content?.toLowerCase() || '';
      
      // Detect category mentions
      if (content.includes('watch') || content.includes('timepiece')) {
        lastCategory = 'watch';
      } else if (content.includes('perfume') || content.includes('fragrance') || content.includes('cologne')) {
        lastCategory = 'fragrance';
      } else if (content.includes('jewelry') || content.includes('bracelet') || content.includes('necklace')) {
        lastCategory = 'jewelry';
      }
      
      // Detect gift recipient
      if (content.includes('husband') || content.includes('him') || content.includes('he ') || content.includes('his ')) {
        giftRecipient = 'husband';
        lastGender = 'men';
      } else if (content.includes('wife') || content.includes('her') || content.includes('she ') || content.includes('hers')) {
        giftRecipient = 'wife';
        lastGender = 'women';
      }
      
      // Extract age information
      if (content.includes('75th birthday') || content.includes('75th') || content.includes('seventy-five') || content.includes('seventy five')) {
        lastAge = 'elderly';
      } else if (content.includes('teen') || content.includes('teenager') || content.includes('student') || content.includes('college')) {
        lastAge = 'young';
      } else if (content.includes('professional') || content.includes('career') || content.includes('working')) {
        lastAge = 'adult';
      } else if (content.includes('senior') || content.includes('experienced') || content.includes('established')) {
        lastAge = 'mature';
      }
      
      // Extract budget information
      const budgetMatch = content.match(/budget.*?(\d+)/);
      if (budgetMatch) {
        const amount = parseInt(budgetMatch[1]);
        lastBudget = { max: amount };
      }
    }
    
    return { lastCategory, lastGender, lastAge, lastBudget, giftRecipient };
  }

  // Intelligent gender detection using semantic understanding
  private intelligentGenderDetection(query: string, conversationContext: any): 'men' | 'women' | 'unisex' | null {
    const queryLower = query.toLowerCase();
    
    // Direct gender references
    const maleIndicators = [
      'husband', 'boyfriend', 'dad', 'father', 'son', 'brother', 'uncle', 'grandfather',
      'him', 'his', 'he ', 'man', 'guy', 'male', 'men', 'mens', "men's"
    ];
    
    const femaleIndicators = [
      'wife', 'girlfriend', 'mom', 'mother', 'daughter', 'sister', 'aunt', 'grandmother',
      'her', 'hers', 'she ', 'woman', 'lady', 'female', 'women', 'womens', "women's"
    ];
    
    // Check for direct indicators with fuzzy matching
    const words = queryLower.split(/\s+/);
    for (const word of words) {
      // Exact matches first
      if (maleIndicators.includes(word)) return 'men';
      if (femaleIndicators.includes(word)) return 'women';
      
      // Fuzzy matching for typos
      for (const indicator of maleIndicators) {
        if (this.levenshteinDistance(word, indicator) <= 1 && word.length > 2) {
          return 'men';
        }
      }
      for (const indicator of femaleIndicators) {
        if (this.levenshteinDistance(word, indicator) <= 1 && word.length > 2) {
          return 'women';
        }
      }
    }
    
    // Use conversation context if no direct indicators
    return conversationContext.lastGender || null;
  }

  // Intelligent age detection using semantic understanding
  private intelligentAgeDetection(query: string, conversationContext: any): 'young' | 'adult' | 'mature' | 'elderly' | null {
    const queryLower = query.toLowerCase();
    
    // Age-specific indicators
    const youngIndicators = [
      'teen', 'teenager', 'teenage', 'adolescent', 'young', 'youth', 'kid', 'child', 'children',
      'student', 'college', 'university', 'school', 'high school', 'middle school',
      'first job', 'starting career', 'new graduate', 'freshman', 'sophomore'
    ];
    
    const adultIndicators = [
      'adult', 'professional', 'working', 'career', 'office', 'business', 'corporate',
      'colleague', 'coworker', 'boss', 'manager', 'executive', 'entrepreneur',
      'young professional', 'millennial', 'gen z', 'gen y'
    ];
    
    const matureIndicators = [
      'mature', 'established', 'experienced', 'senior', 'veteran', 'expert', 'seasoned',
      'mid-career', 'mid-life', 'established professional', 'senior manager',
      'director', 'vice president', 'partner', 'owner'
    ];
    
    const elderlyIndicators = [
      'elderly', 'senior', 'senior citizen', 'retired', 'retirement', 'golden years',
      'grandparent', 'grandmother', 'grandfather', 'grandma', 'grandpa',
      '75th birthday', '75th', 'seventy-fifth', 'seventy five', '70s', '70s birthday',
      '80th birthday', '80th', 'eightieth', 'eighty', '80s', '80s birthday',
      '90th birthday', '90th', 'ninetieth', 'ninety', '90s', '90s birthday',
      'century', '100th', 'hundredth', '100 years', '100 years old'
    ];
    
    // Check for direct indicators with fuzzy matching
    const words = queryLower.split(/\s+/);
    for (const word of words) {
      // Exact matches first
      if (youngIndicators.includes(word)) return 'young';
      if (adultIndicators.includes(word)) return 'adult';
      if (matureIndicators.includes(word)) return 'mature';
      if (elderlyIndicators.includes(word)) return 'elderly';
      
      // Fuzzy matching for typos
      for (const indicator of youngIndicators) {
        if (this.levenshteinDistance(word, indicator) <= 1 && word.length > 2) {
          return 'young';
        }
      }
      for (const indicator of adultIndicators) {
        if (this.levenshteinDistance(word, indicator) <= 1 && word.length > 2) {
          return 'adult';
        }
      }
      for (const indicator of matureIndicators) {
        if (this.levenshteinDistance(word, indicator) <= 1 && word.length > 2) {
          return 'mature';
        }
      }
      for (const indicator of elderlyIndicators) {
        if (this.levenshteinDistance(word, indicator) <= 1 && word.length > 2) {
          return 'elderly';
        }
      }
    }
    
    // Check for specific age numbers (e.g., "75th birthday")
    const ageMatches = queryLower.match(/(\d+)(?:st|nd|rd|th)?\s*(?:birthday|years?\s*old|age)/);
    if (ageMatches) {
      const age = parseInt(ageMatches[1]);
      if (age < 18) return 'young';
      if (age < 30) return 'adult';
      if (age < 60) return 'mature';
      return 'elderly';
    }
    
    // Use conversation context if no direct indicators
    return conversationContext.lastAge || null;
  }

  // Detect category context from current query
  private detectCategoryContext(query: string): string | null {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('watch') || queryLower.includes('timepiece')) return 'watch';
    if (queryLower.includes('perfume') || queryLower.includes('fragrance') || queryLower.includes('cologne')) return 'fragrance';
    if (queryLower.includes('jewelry') || queryLower.includes('bracelet') || queryLower.includes('necklace')) return 'jewelry';
    if (queryLower.includes('wallet') || queryLower.includes('bag') || queryLower.includes('accessory')) return 'accessory';
    
    return null;
  }

  /**
   * Calculate Levenshtein distance between two strings for fuzzy matching
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private searchProductsWithIntent(query: string, products: any[], intent: any, maxProducts: number): any[] {
    console.log(`Searching with provided intent for ${maxProducts} products`);
    
    // Gender and age-aware filtering debug info
    console.log('Gender and Age detection debug:', {
      query,
      hasGenderRequest: intent.categoryHints.some((hint: string) => ['men', 'women', 'male', 'female'].includes(hint.toLowerCase())),
      hasWomenRequest: intent.categoryHints.some((hint: string) => ['women', 'female'].includes(hint.toLowerCase())),
      genderContext: intent.genderContext,
      ageContext: intent.ageContext,
      categoryHints: intent.categoryHints,
      searchTerms: intent.searchTerms,
      productsLength: products.length
    });
    
    // Score products based on various factors
    const scoredProducts = products.map(product => {
      let score = 10; // Base score
      
      // Brand matching (high priority)
      if (intent.brandPreferences.length > 0) {
        const brandMatch = intent.brandPreferences.some((brand: string) => 
          product.brand?.toLowerCase().includes(brand.toLowerCase()) ||
          product.title?.toLowerCase().includes(brand.toLowerCase())
        );
        if (brandMatch) score += 100;
      }
      
      // Category matching
      intent.categoryHints.forEach((category: string) => {
        if (product.title?.toLowerCase().includes(category.toLowerCase()) || 
            product.description?.toLowerCase().includes(category.toLowerCase()) ||
            (product as any).additionalFields?.product_type?.toLowerCase().includes(category.toLowerCase())) {
          score += 20;
        }
      });
      
      // Price range filtering
      if (intent.priceFilter) {
        const productPrice = parseFloat(product.price?.replace(/[^0-9.]/g, '') || '0');
        const { min = 0, max = Infinity } = intent.priceFilter;
        console.log(`Price filtering: ${product.title} - ${productPrice} (range: ${min}-${max})`);
        if (productPrice >= min && productPrice <= max) {
          score += 30;
        } else {
          score = 0; // Exclude products outside price range
          console.log(`  -> EXCLUDED: ${productPrice} not in range ${min}-${max}`);
        }
      }
      
      // Quality level matching
      if (intent.qualityLevel === 'luxury') {
        if (product.title?.toLowerCase().includes('luxury') || 
            product.title?.toLowerCase().includes('premium') ||
            parseFloat(product.price?.replace(/[^0-9.]/g, '') || '0') > 800) {
          score += 40;
        }
      }
      
      // Intelligent gender filtering using context
      if (intent.genderContext) {
        const productType = (product as any).additionalFields?.product_type?.toLowerCase() || product.title?.toLowerCase() || '';
        const isMens = productType.includes('men') && !productType.includes('women');
        const isWomens = productType.includes('women') && !productType.includes('men');
        const isUnisex = productType.includes('unisex') || (!isMens && !isWomens);
        
        console.log(`Gender filtering: ${product.title} - Type: ${productType}, Intent: ${intent.genderContext}`);
        
        if (intent.genderContext === 'men') {
          if (isWomens && !isUnisex) {
            score = 0; // Exclude women's products for men's requests
            console.log(`  -> EXCLUDED: Women's product for men's request`);
          } else if (isMens) {
            score += 300; // Strong boost for men's products
          } else if (isUnisex) {
            score += 100; // Moderate boost for unisex products
          }
        } else if (intent.genderContext === 'women') {
          if (isMens && !isUnisex) {
            score = 0; // Exclude men's products for women's requests
            console.log(`  -> EXCLUDED: Men's product for women's request`);
          } else if (isWomens) {
            score += 300; // Strong boost for women's products
          } else if (isUnisex) {
            score += 100; // Moderate boost for unisex products
          }
        }
      }
      
      // Intelligent age-appropriate product scoring
      if (intent.ageContext) {
        const productType = (product as any).additionalFields?.product_type?.toLowerCase() || product.title?.toLowerCase() || '';
        const productPrice = parseFloat(product.price?.replace(/[^0-9.]/g, '') || '0');
        
        console.log(`Age filtering: ${product.title} - Type: ${productType}, Price: ${productPrice}, Intent: ${intent.ageContext}`);
        
        if (intent.ageContext === 'young') {
          // Young people prefer trendy, affordable, and modern products
          if (productPrice < 300) score += 200; // Budget-friendly boost
          if (productType.includes('trendy') || productType.includes('modern') || productType.includes('contemporary')) {
            score += 150;
          }
          // Boost for brands popular with young people
          if (['police', 'guess', 'juvenis'].some(brand => product.title?.toLowerCase().includes(brand))) {
            score += 100;
          }
        } else if (intent.ageContext === 'adult') {
          // Adults prefer professional, versatile, and mid-range products
          if (productPrice >= 300 && productPrice <= 800) score += 150; // Mid-range boost
          if (productType.includes('professional') || productType.includes('versatile') || productType.includes('classic')) {
            score += 100;
          }
          // Boost for professional brands
          if (['aigner', 'fabian', 'lencia'].some(brand => product.title?.toLowerCase().includes(brand))) {
            score += 100;
          }
        } else if (intent.ageContext === 'mature') {
          // Mature people prefer sophisticated, established, and premium products
          if (productPrice >= 500 && productPrice <= 1200) score += 150; // Premium boost
          if (productType.includes('sophisticated') || productType.includes('established') || productType.includes('premium')) {
            score += 100;
          }
          // Boost for luxury brands
          if (['roberto cavalli', 'tom ford', 'cartier'].some(brand => product.title?.toLowerCase().includes(brand))) {
            score += 100;
          }
        } else if (intent.ageContext === 'elderly') {
          // Elderly people prefer classic, elegant, and timeless products
          if (productPrice >= 400) score += 200; // Quality over price boost
          if (productType.includes('classic') || productType.includes('elegant') || productType.includes('timeless')) {
            score += 150;
          }
          // Boost for classic luxury brands
          if (['cartier', 'roberto cavalli', 'tom ford'].some(brand => product.title?.toLowerCase().includes(brand))) {
            score += 150;
          }
          // Special boost for gift-appropriate products
          if (productType.includes('gift') || productType.includes('special') || productType.includes('occasion')) {
            score += 100;
          }
        }
      }
      
      return { ...product, searchScore: score };
    });
    
    // Filter products with score > 0 and sort by score
    const filteredProducts = scoredProducts
      .filter(product => product.searchScore > 0)
      .sort((a, b) => b.searchScore - a.searchScore)
      .slice(0, maxProducts);
    
    return filteredProducts;
  }

  private async searchProductsIntelligently(query: string, products: any[], maxProducts: number, conversationHistory: any[] = []): Promise<any[]> {
    console.log(`Starting intelligent search with maxProducts=${maxProducts}`);
    const intent = this.parseUserIntent(query, conversationHistory);
    console.log('Parsed user intent:', JSON.stringify(intent, null, 2));
    
    const queryLower = query.toLowerCase();
    
    // 🚨 CRITICAL: Check for specific product comparison requests first
    const isSpecificComparison = this.isSpecificProductComparison(queryLower);
    if (isSpecificComparison) {
      console.log('Specific product comparison detected, searching for exact products');
      const exactProducts = this.findExactProductsForComparison(queryLower, products);
      if (exactProducts.length > 0) {
        console.log(`Found ${exactProducts.length} exact products for comparison`);
        return exactProducts;
      }
    }
    
    // Enhanced category detection
    const categoryHints: string[] = [];
    
    // Check for specific product categories
    if (queryLower.includes('watch') || queryLower.includes('watches')) {
      categoryHints.push('watch');
    }
    if (queryLower.includes('fragrance') || queryLower.includes('fragrances') || 
        queryLower.includes('perfume') || queryLower.includes('perfumes') ||
        queryLower.includes('cologne') || queryLower.includes('colognes')) {
      categoryHints.push('fragrance');
    }
    if (queryLower.includes('accessory') || queryLower.includes('accessories') ||
        queryLower.includes('jewelry') || queryLower.includes('jewellery')) {
      categoryHints.push('accessory');
    }
    if (queryLower.includes('bath') || queryLower.includes('soap') || queryLower.includes('soaps') ||
        queryLower.includes('body wash') || queryLower.includes('shower gel')) {
      categoryHints.push('bath');
    }
    
    console.log('Category detection debug:', {
      query: query,
      detectedCategories: categoryHints
    });
    
    // CRITICAL: Check if we have any products matching the requested category
    if (categoryHints.length > 0) {
      const hasCategoryProducts = this.checkIfCategoryExists(products, categoryHints);
      if (!hasCategoryProducts) {
        console.log('No products found for requested category:', categoryHints);
        return [];
      }
    }
    
    // Special handling for "men's accessories" - highest priority
    const isMensAccessoriesQuery = (queryLower.includes("men's") || queryLower.includes('mens') || queryLower.includes('men')) && 
                                  (queryLower.includes('accessory') || queryLower.includes('accessories'));
    
    // Brand-specific query detection
    const isBrandQuery = queryLower.includes('brand') || 
                        intent.searchTerms.some(term => ['aigner', 'fabian', 'lencia', 'police', 'roberto cavalli', 'tom ford'].includes(term.toLowerCase()));
    
    const isNewCollectionQuery = queryLower.includes('new') || queryLower.includes('latest') || 
                               queryLower.includes('recent') || queryLower.includes('arrival') || 
                               queryLower.includes('collection');
    
    // Detect gender-specific requests - ENHANCED DETECTION
    const hasGenderRequest = intent.categoryHints.some(hint => ['men', 'male', 'mans', 'mens', 'cologne'].includes(hint)) ||
                            intent.searchTerms.some(term => ['men', 'male', 'mans', 'mens', 'cologne'].includes(term)) ||
                            queryLower.includes('men') ||
                            queryLower.includes('cologne') ||
                            queryLower.includes("men's") ||
                            queryLower.includes('for dad') ||
                            queryLower.includes('for him') ||
                            queryLower.includes('for husband') ||
                            queryLower.includes('for boyfriend') ||
                            queryLower.includes('for father') ||
                            queryLower.includes('for gentleman');
    const hasWomenRequest = intent.categoryHints.some(hint => ['women', 'female', 'womans', 'womens'].includes(hint)) ||
                           intent.searchTerms.some(term => ['women', 'female', 'womans', 'womens'].includes(term)) ||
                           queryLower.includes('women') ||
                           queryLower.includes("women's") ||
                           queryLower.includes('for mom') ||
                           queryLower.includes('for her') ||
                           queryLower.includes('for wife') ||
                           queryLower.includes('for girlfriend') ||
                           queryLower.includes('for mother') ||
                           queryLower.includes('for lady') ||
                           queryLower.includes('for ladies');


    


    
    // Score products based on relevance
    const scoredProducts = products.map(product => {
      let score = 0;
      
      // Get product fields for filtering
      const titleLower = (product.title || '').toLowerCase();
      const descLower = (product.description || '').toLowerCase();
      const categoryLower = (product.additionalFields && typeof product.additionalFields === 'object' && 'product_type' in product.additionalFields ? 
                            (product.additionalFields.product_type as string || '').toLowerCase() : '');
      const brandLower = (product.brand || '').toLowerCase();
      const productTypeField = (product.additionalFields?.product_type || '').toLowerCase();
      
      // Category-specific scoring
      if (categoryHints.includes('watch')) {
        // CRITICAL: When user asks for watches, ONLY show watch products
        if (categoryLower.includes('watch') || categoryLower.includes('timepiece') || 
            categoryLower.includes('chronograph') || categoryLower.includes('clock')) {
          score += 1000; // Massive boost for watch products
          console.log(`BOOSTED ${product.title} by 1000 for watch category match`);
        } else {
          score = 0; // EXCLUDE non-watch products completely
          console.log(`EXCLUDED ${product.title} - not a watch product`);
        }
      } else if (categoryHints.includes('fragrance')) {
        // CRITICAL: When user asks for fragrances, ONLY show fragrance products
        if (categoryLower.includes('fragrance') || categoryLower.includes('perfume') || 
            categoryLower.includes('cologne')) {
          score += 1000; // Massive boost for fragrance products
          console.log(`BOOSTED ${product.title} by 1000 for fragrance category match`);
        } else {
          score = 0; // EXCLUDE non-fragrance products completely
          console.log(`EXCLUDED ${product.title} - not a fragrance product`);
        }
      } else if (categoryHints.includes('accessory')) {
        // CRITICAL: When user asks for accessories, ONLY show accessory products
        if (categoryLower.includes('jewelry') || categoryLower.includes('accessory') || 
            categoryLower.includes('bracelet') || categoryLower.includes('necklace') ||
            categoryLower.includes('wallet') || categoryLower.includes('bag')) {
          score += 1000; // Massive boost for accessory products
          console.log(`BOOSTED ${product.title} by 1000 for accessory category match`);
        } else {
          score = 0; // EXCLUDE non-accessory products completely
          console.log(`EXCLUDED ${product.title} - not an accessory product`);
        }
      } else if (categoryHints.includes('bath')) {
        // CRITICAL: When user asks for bath products, ONLY show bath products
        if (categoryLower.includes('bath') || categoryLower.includes('soap') || 
            categoryLower.includes('body') || categoryLower.includes('shower') ||
            categoryLower.includes('gel') || categoryLower.includes('wash')) {
          score += 1000; // Massive boost for bath products
          console.log(`BOOSTED ${product.title} by 1000 for bath category match`);
        } else {
          score = 0; // EXCLUDE non-bath products completely
          console.log(`EXCLUDED ${product.title} - not a bath product`);
        }
      } else if (categoryHints.includes('electronics')) {
        // CRITICAL: Electronics are not our business - exclude all products
        score = 0; // Force exclude all products for electronics requests
        console.log(`EXCLUDED ${product.title} - electronics not sold`);
      }
      
      // Category matching
      intent.categoryHints.forEach((category: string) => {
        if (product.title?.toLowerCase().includes(category.toLowerCase()) || 
            product.description?.toLowerCase().includes(category.toLowerCase()) ||
            (product as any).additionalFields?.product_type?.toLowerCase().includes(category.toLowerCase())) {
          score += 20;
        }
      });
      
      // CRITICAL: Final category validation - ensure products match requested category
      if (intent.categoryHints.length > 0) {
        const productType = (product.additionalFields?.product_type || '').toLowerCase();
        const titleLower = (product.title || '').toLowerCase();
        const descLower = (product.description || '').toLowerCase();
        const allText = `${titleLower} ${descLower} ${productType}`.toLowerCase();
        
        // Check if product matches ANY of the requested categories
        const matchesRequestedCategory = intent.categoryHints.some(category => {
          const categoryLower = category.toLowerCase();
          
          // For watch category, check specific watch-related terms
          if (categoryLower === 'watch') {
            return allText.includes('watch') || allText.includes('timepiece') || 
                   allText.includes('chronograph') || allText.includes('clock');
          }
          
          // For fragrance category, check specific fragrance-related terms
          if (categoryLower === 'fragrance') {
            return allText.includes('fragrance') || allText.includes('perfume') || 
                   allText.includes('cologne') || allText.includes('edp') || 
                   allText.includes('edt') || allText.includes('eau');
          }
          
          // For accessory category, check specific accessory-related terms
          if (categoryLower === 'accessory') {
            return allText.includes('jewelry') || allText.includes('accessory') || 
                   allText.includes('bracelet') || allText.includes('necklace') ||
                   allText.includes('wallet') || allText.includes('bag');
          }
          
          // For bath category, check specific bath-related terms
          if (categoryLower === 'bath') {
            return allText.includes('bath') || allText.includes('soap') || 
                   allText.includes('body') || allText.includes('shower') ||
                   allText.includes('gel') || allText.includes('wash');
          }
          
          // Generic category matching
          return allText.includes(categoryLower);
        });
        
        // If product doesn't match any requested category, exclude it completely
        if (!matchesRequestedCategory) {
          score = 0;
          console.log(`EXCLUDED ${product.title} - does not match requested category: ${intent.categoryHints.join(', ')}`);
        }
      }
      
      // Price range filtering
      if (intent.priceFilter) {
        const productPrice = parseFloat(product.price?.replace(/[^\d.]/g, '') || '0');
        const { min = 0, max = Infinity } = intent.priceFilter;
        console.log(`Price filtering: ${product.title} - ${productPrice} (range: ${min}-${max})`);
        if (productPrice >= min && productPrice <= max) {
          score += 30;
        } else {
          score = 0; // Exclude products outside price range
          console.log(`  -> EXCLUDED: ${productPrice} not in range ${min}-${max}`);
        }
      }
      
      // Quality level matching
      if (intent.qualityLevel === 'luxury') {
        if (product.title?.toLowerCase().includes('luxury') || 
            product.title?.toLowerCase().includes('premium') ||
            parseFloat(product.price?.replace(/[^0-9.]/g, '') || '0') > 800) {
          score += 40;
        }
      }
      
      // Intelligent gender filtering using context
      if (intent.genderContext) {
        const productType = (product as any).additionalFields?.product_type?.toLowerCase() || product.title?.toLowerCase() || '';
        const isMens = productType.includes('men') && !productType.includes('women');
        const isWomens = productType.includes('women') && !productType.includes('men');
        const isUnisex = productType.includes('unisex') || (!isMens && !isWomens);
        
        console.log(`Gender filtering: ${product.title} - Type: ${productType}, Intent: ${intent.genderContext}`);
        
        if (intent.genderContext === 'men') {
          if (isWomens && !isUnisex) {
            score = 0; // Exclude women's products for men's requests
            console.log(`  -> EXCLUDED: Women's product for men's request`);
          } else if (isMens) {
            score += 300; // Strong boost for men's products
          } else if (isUnisex) {
            score += 100; // Moderate boost for unisex products
          }
        } else if (intent.genderContext === 'women') {
          if (isMens && !isUnisex) {
            score = 0; // Exclude men's products for women's requests
            console.log(`  -> EXCLUDED: Men's product for women's request`);
          } else if (isWomens) {
            score += 300; // Strong boost for women's products
          } else if (isUnisex) {
            score += 100; // Moderate boost for unisex products
          }
        }
      }
      
      // New collection boost
      if (isNewCollectionQuery) {
        // Boost products that might be newer (this could be enhanced with actual date fields)
        if (titleLower.includes('new') || descLower.includes('new') || 
            titleLower.includes('2025') || titleLower.includes('latest')) {
          score += 50;
        }
      }
      
      // Gender-specific filtering and scoring - ENHANCED PRECISION VERSION
      const allText = `${titleLower} ${descLower}`.toLowerCase();
      
      // More precise women's product detection
      const isWomensProduct = productTypeField.includes('women') || 
                             titleLower.includes('for women') || 
                             (titleLower.includes('women') && !titleLower.includes('for men')) ||
                             titleLower.includes('woman edp') || titleLower.includes('woman edt') ||
                             allText.includes('feminine') || allText.includes('for her');
      
      // More precise men's product detection - excluding "homme" false positives
      const isMensProduct = (productTypeField.includes('men') && !productTypeField.includes('women')) || 
                           titleLower.includes('for men') || 
                           (titleLower.includes('cologne') && !titleLower.includes('women')) ||
                           (titleLower.includes('homme') && (titleLower.includes('for men') || titleLower.includes('men'))) ||
                           titleLower.includes('man edt') || titleLower.includes('man edp') ||
                           allText.includes('masculine') || allText.includes('for him');
      
      const isUnisexProduct = productTypeField.includes('unisex') && !isWomensProduct && !isMensProduct;
      

      


      // CRITICAL FIX: Strict gender filtering - completely exclude wrong gender products
      if (hasWomenRequest) {
        // For women's requests, ONLY allow women's and unisex products
        if (isWomensProduct) {
          score += 200; // Massive boost for women's products
        } else if (isUnisexProduct) {
          score += 50; // Moderate boost for unisex
        } else {
          // EXCLUDE all other products by setting score to 0
          return { ...product, searchScore: 0 };
        }
      }
      
      if (hasGenderRequest && !hasWomenRequest) {
        // For men's requests, ONLY allow men's and unisex products  
        if (isMensProduct) {
          score += 200; // Massive boost for men's products
        } else if (isUnisexProduct) {
          score += 50; // Moderate boost for unisex
        } else {
          // EXCLUDE all other products by setting score to 0
          return { ...product, searchScore: 0 };
        }
      }
      
      // Apply price filter (strict filtering)
      if (intent.priceFilter && product.price) {
        const productPrice = parseFloat(product.price.replace(/[^\d.]/g, ''));
        
        const withinMin = !intent.priceFilter.min || productPrice >= intent.priceFilter.min;
        const withinMax = !intent.priceFilter.max || productPrice <= intent.priceFilter.max;
        
        if (!withinMin || !withinMax) {
          return { ...product, searchScore: 0 }; // Exclude if outside price range
        }
        score += 5; // Bonus for matching price criteria
      }
      
      // Search terms matching with enhanced fragrance note detection
      intent.searchTerms.forEach(term => {
        if (titleLower.includes(term)) score += 4; // Title matches are most important
        if (brandLower.includes(term)) score += 3; // Brand matches are important
        if (categoryLower.includes(term)) score += 3; // Category matches
        if (descLower.includes(term)) score += 2; // Description matches
        
        // CRITICAL: Boost for fragrance note matches (aquatic, fresh, oud, etc.)
        const fragranceNotes = ['aquatic', 'marine', 'ocean', 'sea', 'fresh', 'water', 'blue', 'breeze', 'citrus', 'floral', 'woody', 'musky', 'oriental', 'spicy', 'fruity', 'green', 'light', 'clean', 'airy', 'crisp', 'refreshing', 'oud', 'agarwood', 'incense', 'sandalwood', 'amber', 'resin', 'smoky', 'bakhoor', 'attar'];
        if (fragranceNotes.includes(term.toLowerCase())) {
          // Major boost for fragrance note matches in description or title
          if (descLower.includes(term) || titleLower.includes(term)) {
            score += 80; // Even stronger boost for specialized fragrance notes like oud
          }
          
          // CRITICAL FIX: Also boost if product description contains the fragrance note
          // This is essential for finding oriental/oud products that have these terms in descriptions
          const productDescLower = (product.description || '').toLowerCase();
          if (productDescLower.includes(term.toLowerCase())) {
            score += 200; // Maximum boost for description matches
            console.log(`BOOSTED ${product.title} by 200 for ${term} match in description`);
          }
        }
        
        // SPECIAL HANDLING FOR OUD/INCENSE QUERIES - broader matching
        if (['oud', 'incense', 'sticks'].includes(term.toLowerCase())) {
          const productDescLower = (product.description || '').toLowerCase();
          const productTitleLower = titleLower;
          
          // Boost products with oriental, amber, woody, sandalwood, bakhoor in description
          const orientalTerms = ['oriental', 'amber', 'woody', 'sandalwood', 'agarwood', 'bakhoor', 'attar'];
          orientalTerms.forEach(orientalTerm => {
            if (productDescLower.includes(orientalTerm) || productTitleLower.includes(orientalTerm)) {
              score += 150; // Major boost for related oriental terms
              console.log(`BOOSTED ${product.title} by 150 for oriental term: ${orientalTerm}`);
            }
          });
        }
      });
      
      // Category hints bonus
      intent.categoryHints.forEach(hint => {
        if (titleLower.includes(hint)) score += 2;
        if (categoryLower.includes(hint)) score += 3;
        if (descLower.includes(hint)) score += 1;
      });
      
      // Brand preference bonus - STRICT FILTERING
      if (intent.brandPreferences && intent.brandPreferences.length > 0) {
        // Check if this product matches ANY of the requested brands
        const hasMatchingBrand = intent.brandPreferences.some(brand => 
          brandLower.includes(brand.toLowerCase()) || 
          titleLower.includes(brand.toLowerCase()) ||
          (product.brand && product.brand.toLowerCase().includes(brand.toLowerCase()))
        );
        
        if (hasMatchingBrand) {
          score += 1000; // Massive boost for brand matches
          console.log(`BOOSTED ${product.title} by 1000 for brand match: ${intent.brandPreferences.join(', ')}`);
        } else {
          // EXCLUDE products that don't match the requested brand
          return { ...product, searchScore: 0 };
        }
      } else {
        // If no specific brand requested, give small bonus for brand mentions
        intent.brandPreferences?.forEach(brand => {
          if (brandLower.includes(brand)) score += 5; // Small brand preference bonus
          if (titleLower.includes(brand)) score += 3;
        });
      }
      
      // Quality level alignment
      if (intent.qualityLevel && product.price) {
        const productPrice = parseFloat(product.price.replace(/[^\d.]/g, ''));
        
        switch (intent.qualityLevel) {
          case 'budget':
            if (productPrice <= 300) score += 2;
            break;
          case 'mid-range':
            if (productPrice >= 300 && productPrice <= 1000) score += 2;
            break;
          case 'luxury':
            if (productPrice >= 1000) score += 2;
            break;
        }
      }
      
      // Enhanced deal/discount detection and offers integration
      const dealKeywords = ['deal', 'deals', 'sale', 'discount', 'offer', 'special', 'promo', 'cheap', 'affordable', 'save', 'savings'];
      const isDealQuery = dealKeywords.some(keyword => queryLower.includes(keyword));
      
      if (isDealQuery) {
        // Check if this product has an active offer (check our offers data)
        const hasOffer = this.checkProductOffer(product);
        if (hasOffer) {
          score += 150; // Major boost for products with offers
        } else {
          // Still boost products that might be discounted based on title/description
          if (titleLower.includes('sale') || titleLower.includes('discount') || descLower.includes('special')) {
            score += 30;
          }
          // Boost based on budget-friendly prices
          if (product.price) {
            const productPrice = parseFloat(product.price.replace(/[^\d.]/g, ''));
            if (productPrice <= 500) { // Consider under 500 AED as deal-worthy
              score += 20;
            }
          }
        }
      }
      
      // Final debug for first few products

      
      return { ...product, searchScore: score };
    });
    
    // Debug: Check what scores products are getting
    const debugScores = scoredProducts.slice(0, 5).map(p => ({
      title: p.title.substring(0, 50),
      score: p.searchScore,
      productType: p.additionalFields?.product_type
    }));
    console.log('Top 5 product scores:', debugScores);

    // For deal queries, if no products scored high, lower the threshold
    const isDealQuery = ['deal', 'deals', 'sale', 'discount', 'offer', 'special', 'promo', 'cheap', 'affordable'].some(keyword => 
      queryLower.includes(keyword));
    
    // For specialized searches like oud/incense, lower the threshold significantly
    const isSpecializedFragranceSearch = intent.searchTerms.some((term: string) => 
      ['oud', 'incense', 'oriental', 'amber', 'sandalwood', 'agarwood', 'bakhoor', 'attar'].includes(term.toLowerCase())
    );
    
    // For brand + category specific queries (e.g., "Aigner perfumes"), use higher threshold
    const isBrandCategoryQuery = queryLower.includes('brand') && (
      queryLower.includes('perfume') || queryLower.includes('fragrance') || 
      queryLower.includes('accessory') || queryLower.includes('accessories')
    );
    
    // For perfume-specific queries, be very strict about what constitutes a perfume
    const isPerfumeSpecificQuery = queryLower.includes('perfume') || queryLower.includes('fragrance');
    
    const minScore = isDealQuery ? 5 : isSpecializedFragranceSearch ? 10 : isBrandCategoryQuery ? 300 : 0;
    console.log(`Specialized search detected: ${isSpecializedFragranceSearch}, Brand+Category: ${isBrandCategoryQuery}, Perfume-specific: ${isPerfumeSpecificQuery}, using minScore: ${minScore}`);
    
    // Return products with score > minScore, sorted by score
    console.log(`Before final filtering: ${scoredProducts.filter(p => p.searchScore > minScore).length} products have score > ${minScore}`);
    const filteredProducts = scoredProducts
      .filter(product => product.searchScore > minScore)
      .sort((a, b) => b.searchScore - a.searchScore);
    
    // For perfume-specific queries, exclude jewelry gift sets that are mislabeled as perfume gift sets
    let finalFilteredProducts = filteredProducts;
    if (isPerfumeSpecificQuery) {
      finalFilteredProducts = filteredProducts.filter(product => {
        const titleLower = (product.title || '').toLowerCase();
        const descLower = (product.description || '').toLowerCase();
        const categoryLower = (product.additionalFields?.product_type || '').toLowerCase();
        
        // Exclude jewelry gift sets that are mislabeled as perfume gift sets
        if (categoryLower.includes('gift set') && 
            (titleLower.includes('bracelet') || titleLower.includes('necklace') || 
             titleLower.includes('jewelry') || titleLower.includes('watch') || titleLower.includes('timepiece') ||
             descLower.includes('bracelet') || descLower.includes('necklace') || 
             descLower.includes('jewelry') || descLower.includes('watch') || descLower.includes('timepiece'))) {
          console.log(`Excluding jewelry gift set from final results: ${product.title}`);
          return false;
        }
        return true;
      });
      console.log(`After perfume-specific filtering: ${finalFilteredProducts.length} products remain (excluded ${filteredProducts.length - finalFilteredProducts.length} jewelry gift sets)`);
    }
    
    // Only limit to maxProducts if we have more than that many relevant products
    // This allows showing fewer products when that's all that match the query
    const finalProducts = finalFilteredProducts.length > maxProducts 
      ? finalFilteredProducts.slice(0, maxProducts) 
      : finalFilteredProducts;
    
    console.log(`After final filtering: ${finalProducts.length} products remain (${finalFilteredProducts.length} total relevant, max requested: ${maxProducts})`);
    
    console.log(`Intelligent search found ${finalProducts.length} products matching intent`);
    
    // Apply offer pricing to products before returning
    const productsWithOffers = await this.applyOfferPricing(finalProducts);
    console.log(`Applied offer pricing to ${productsWithOffers.length} products`);
    
    // If no products found and user had specific brand preferences or Tom Ford mentioned, suggest alternatives
    const hasTomFordRequest = query.toLowerCase().includes('tom ford');
    const hasLuxuryBrandRequest = intent.brandPreferences.length > 0 || hasTomFordRequest;
    
    if (productsWithOffers.length === 0 && hasLuxuryBrandRequest) {
      const brandName = hasTomFordRequest ? 'Tom Ford' : intent.brandPreferences.length > 0 ? intent.brandPreferences.join(', ') : 'requested brand';
      console.log(`No products found for brand: ${brandName}, searching for alternatives in same price range`);
      
      // Remove brand preference and search again for alternative suggestions
      const altIntent = { ...intent, brandPreferences: [] };
      const alternativeProducts = this.searchProductsWithIntent(query, products, altIntent, maxProducts);
      const alternativesWithOffers = await this.applyOfferPricing(alternativeProducts);
      console.log(`Found ${alternativesWithOffers.length} alternative products in same criteria`);
      
      // Mark products as alternatives for intelligent messaging
      const markedAlternatives = alternativesWithOffers.map(product => ({
        ...product,
        isAlternativeTo: brandName,
        alternativeReason: `${brandName} products typically start from 600+ AED. Here are excellent alternatives in your budget:`
      }));
      
      return markedAlternatives;
    }
    
    return productsWithOffers;
  }

  public async clearIndex(): Promise<void> {
    try {
      // Note: clearCollection method would need to be implemented in ChromaVectorDBService
      console.log('Vector index clear requested');
    } catch (error) {
      console.error('Error clearing index:', error);
    }
  }

  private async applyOfferPricing(products: any[]): Promise<any[]> {
    try {
      const offers = await storage.getOffers();
      console.log(`Applying offers to ${products.length} products, ${offers.length} offers available`);
      
      return products.map(product => {
        // Find matching offer
        const matchingOffer = offers.find(offer => 
          offer.productId === product.id || 
          offer.productId === product.link ||
          (product.link && product.link.includes(offer.productId)) ||
          (product.id && product.id.includes(offer.productId))
        );
        
        if (matchingOffer) {
          console.log(`Found offer for ${product.title}: ${(matchingOffer as any).originalPrice} -> ${matchingOffer.discountPrice}`);
          return {
            ...product,
            discountPrice: matchingOffer.discountPrice,
            originalPrice: (matchingOffer as any).originalPrice || product.price,
            offerDetails: {
              discountPercentage: (matchingOffer as any).discountPercentage,
              startDate: (matchingOffer as any).startDate,
              endDate: (matchingOffer as any).endDate,
              description: (matchingOffer as any).description || matchingOffer.offerDesc
            }
          };
        }
        
        return product;
      });
    } catch (error) {
      console.error('Error applying offer pricing:', error);
      return products;
    }
  }

  private checkProductOffer(product: any): boolean {
    // This is a simplified check - in production this would query the offers database
    // For now, check if product matches our demo offers
    const demoOfferIds = [
      'https://www.karjistore.com/roberto-cavalli-paradiso-edp-75ml',
      'https://www.karjistore.com/roberto-cavalli-uomo-edt-100ml',
      'https://www.karjistore.com/tom-ford-ombre-leather-edp',
      'https://www.karjistore.com/aigner-fashion-leather-men-bracelet-m-aj77073',
      'gift-set-001'
    ];
    
    return demoOfferIds.includes(product.id) || demoOfferIds.includes(product.link);
  }

  /**
   * Check if any products exist for the requested category
   */
  private checkIfCategoryExists(products: any[], categoryHints: string[]): boolean {
    if (!products || products.length === 0) return false;
    
    return products.some(product => {
      const titleLower = (product.title || '').toLowerCase();
      const descLower = (product.description || '').toLowerCase();
      const categoryLower = (product.additionalFields?.product_type || '').toLowerCase();
      
      return categoryHints.some(hint => {
        const hintLower = hint.toLowerCase();
        
        // Check if product matches the category hint
        if (hintLower === 'watch') {
          return categoryLower.includes('watch') || categoryLower.includes('timepiece') || 
                 titleLower.includes('watch') || titleLower.includes('timepiece');
        }
        if (hintLower === 'fragrance') {
          return categoryLower.includes('fragrance') || categoryLower.includes('perfume') || 
                 categoryLower.includes('cologne') || categoryLower.includes('edp') || 
                 categoryLower.includes('edt');
        }
        if (hintLower === 'accessory') {
          return categoryLower.includes('jewelry') || categoryLower.includes('accessory') || 
                 categoryLower.includes('bracelet') || categoryLower.includes('necklace') ||
                 categoryLower.includes('wallet') || categoryLower.includes('bag');
        }
        if (hintLower === 'bath') {
          return categoryLower.includes('bath') || categoryLower.includes('soap') || 
                 categoryLower.includes('body') || categoryLower.includes('shower') ||
                 categoryLower.includes('gel') || categoryLower.includes('wash');
        }
        if (hintLower === 'electronics') {
          // We don't sell electronics, so this should always return false
          return false;
        }
        
        // Generic category matching
        return titleLower.includes(hintLower) || 
               descLower.includes(hintLower) || 
               categoryLower.includes(hintLower);
      });
    });
  }

  public async reindexAll(): Promise<void> {
    console.log('Reindexing all documents and products...');
    await this.clearIndex();
    await this.indexAllDocuments();
    await this.indexAllProducts();
    
    // Save consolidated product vectors after reindexing
    try {
      const { langchainRAGService } = await import('./langchainRAG.js');
      await langchainRAGService.saveAllProductsVector();
      console.log('Consolidated product vectors saved after reindexing');
    } catch (error) {
      console.error('Error saving consolidated vectors during reindex:', error);
    }
    
    console.log('Reindexing complete');
  }

  public async findSimilarProducts(
    query: string, 
    previousProducts: any[], 
    options?: {
      maxDocuments?: number;
      maxProducts?: number;
      similarityThreshold?: number;
    }
  ): Promise<RAGContext> {
    if (!this.isInitialized) await this.initialize();

    const { 
      maxDocuments = 2, 
      maxProducts = 4, 
      similarityThreshold = 0.1 
    } = options || {};

    try {
      console.log(`Finding similar products based on ${previousProducts.length} previously shown products`);
      
      // Get all products from storage
      const allProducts = await storage.getProducts();
      
      if (previousProducts.length === 0) {
        // Fallback to regular search if no previous products
        return await this.findRelevantContext(query, options);
      }

      // Extract characteristics from previously shown products
      const extractedCategories = new Set<string>();
      const extractedBrands = new Set<string>();
      const priceRanges: number[] = [];
      const extractedGenders = new Set<string>();
      
      previousProducts.forEach((product, index) => {
        // Extract categories from title and description
        const text = `${product.title || ''} ${product.description || ''}`.toLowerCase();
        const productType = ((product as any).additionalFields?.product_type || '').toLowerCase();
        
        // Category extraction
        if (text.includes('perfume') || text.includes('fragrance')) extractedCategories.add('perfume');
        if (text.includes('watch')) extractedCategories.add('watch');
        if (text.includes('jewelry')) extractedCategories.add('jewelry');
        
        // CRITICAL: Gender extraction from both text and product_type
        if (text.includes('women') || text.includes('female') || productType.includes('women')) {
          extractedGenders.add('women');
          extractedCategories.add('women');
        }
        if (text.includes('men') || text.includes('male') || text.includes('homme') || text.includes('cologne') || productType.includes('men')) {
          extractedGenders.add('men');
          extractedCategories.add('men');
        }
        if (productType.includes('unisex')) {
          extractedGenders.add('unisex');
        }
        
        // Brand extraction
        if (product.brand) extractedBrands.add(product.brand.toLowerCase());
        
        // Price extraction
        if (product.price) {
          const price = parseFloat(product.price.replace(/[^\d.]/g, ''));
          if (!isNaN(price)) priceRanges.push(price);
        }
      });

      // Calculate average price range for similarity
      const avgPrice = priceRanges.length > 0 ? priceRanges.reduce((a, b) => a + b, 0) / priceRanges.length : null;
      
      console.log(`Extracted characteristics - Categories: ${Array.from(extractedCategories).join(', ')}, Brands: ${Array.from(extractedBrands).join(', ')}, Genders: ${Array.from(extractedGenders).join(', ')}, Avg Price: ${avgPrice}`);

      // Score products based on similarity to previously shown ones
      const scoredProducts = allProducts
        .filter(product => !previousProducts.some(prev => prev.id === product.id)) // Exclude already shown products
        .map(product => {
          let score = 0;
          const productText = `${product.title || ''} ${product.description || ''}`.toLowerCase();
          const productType = ((product as any).additionalFields?.product_type || '').toLowerCase();
          
          // CRITICAL: Gender filtering - must match the gender of previously shown products
          const isWomensProduct = productText.includes('women') || productText.includes('female') || productType.includes('women') || 
                                 productText.includes('woman') || productText.includes('her ') || productText.includes(' her') ||
                                 productText.includes('she ') || productText.includes('ladies');
          const isMensProduct = (productText.includes('men') && !productText.includes('women')) || 
                               (productText.includes('male') && !productText.includes('female')) || 
                               productText.includes('homme') || productText.includes('cologne') || 
                               productType.includes('men') || 
                               (productText.includes('man ') && !productText.includes('woman')) ||
                               productText.includes('his ') || productText.includes(' his') || 
                               productText.includes('he ') || productText.includes('gentleman');
          const isUnisexProduct = productType.includes('unisex') && !isWomensProduct && !isMensProduct;
          


          // If previous products had specific gender, enforce strict gender matching
          if (extractedGenders.has('men') && !extractedGenders.has('women')) {
            // Previous products were men's only - exclude women's products completely
            if (isWomensProduct) {
              return { ...product, similarity: 0 }; // Exclude ALL women's products (including mislabeled ones)
            }
            if (isMensProduct) {
              score += 10; // Strong boost for men's products
            } else if (isUnisexProduct) {
              score += 5; // Moderate boost for true unisex products
            }
          } else if (extractedGenders.has('women') && !extractedGenders.has('men')) {
            // Previous products were women's only - exclude men's products
            if (isMensProduct && !isUnisexProduct) {
              return { ...product, similarity: 0 }; // Exclude men's products
            }
            if (isWomensProduct || isUnisexProduct) {
              score += 10; // Strong boost for matching gender
            }
          }
          
          // Category similarity
          extractedCategories.forEach(category => {
            if (productText.includes(category)) {
              score += 3; // Strong category match
            }
          });
          
          // Brand similarity
          if (product.brand && extractedBrands.has(product.brand.toLowerCase())) {
            score += 2; // Brand match
          }
          
          // Price similarity (within 50% range)
          if (avgPrice && product.price) {
            const productPrice = parseFloat(product.price.replace(/[^\d.]/g, ''));
            if (!isNaN(productPrice)) {
              const priceDiff = Math.abs(productPrice - avgPrice) / avgPrice;
              if (priceDiff <= 0.5) {
                score += 1; // Price similarity
              }
            }
          }
          
          // Query relevance (original search terms)
          const queryWords = query.toLowerCase().split(/\s+/);
          queryWords.forEach(word => {
            if (word.length > 2 && productText.includes(word)) {
              score += 0.5; // Query relevance bonus
            }
          });
          
          return { ...product, similarity: score };
        })
        .filter(product => product.similarity > 0)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, maxProducts);

      console.log(`Found ${scoredProducts.length} similar products with scores: ${scoredProducts.map(p => `${p.title?.substring(0, 30)}... (${p.similarity})`).join(', ')}`);

      // Get documents as usual
      const documents = await storage.getDocuments();
      const relevantDocs = documents
        .map(doc => ({ 
          ...doc, 
          similarity: this.calculateBasicSimilarity(query, doc.content || '') 
        }))
        .filter(doc => doc.similarity > similarityThreshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, maxDocuments);

      return {
        documents: relevantDocs,
        products: scoredProducts,
        relevantChunks: []
      };
      
    } catch (error) {
      console.error('Error finding similar products:', error);
      // Fallback to regular search
      return await this.findRelevantContext(query, options);
    }
  }

  /**
   * Check if the query is requesting a specific product comparison
   */
  private isSpecificProductComparison(query: string): boolean {
    const comparisonKeywords = ['compare', 'comparison', 'versus', 'vs', 'difference between', 'side by side'];
    const hasComparisonKeyword = comparisonKeywords.some(keyword => query.includes(keyword));
    
    // Check for specific product names (e.g., "Gucci Flora Gorgeous Jasmine vs Magnolia")
    const hasSpecificProducts = query.includes('gucci') && query.includes('flora') && 
                               (query.includes('jasmine') || query.includes('magnolia') || query.includes('gardenia') || query.includes('orchid'));
    
    return hasComparisonKeyword && hasSpecificProducts;
  }

  /**
   * Find exact products for specific comparison requests
   */
  private findExactProductsForComparison(query: string, products: any[]): any[] {
    const queryLower = query.toLowerCase();
    const foundProducts: any[] = [];
    
    // Extract product names from the query
    const productNames: string[] = [];
    
    // Check for Gucci Flora Gorgeous variants
    if (queryLower.includes('jasmine')) {
      productNames.push('Gucci Flora Gorgeous Jasmine EDP 100ml');
    }
    if (queryLower.includes('magnolia')) {
      productNames.push('Gucci Flora Gorgeous Magnolia EDP 100ml');
    }
    if (queryLower.includes('gardenia')) {
      productNames.push('Gucci Flora Gorgeous Gardenia EDP 100ml');
    }
    if (queryLower.includes('orchid')) {
      productNames.push('Gucci Flora Gorgeous Orchid EDP 100ml');
    }
    
    console.log('Looking for exact products:', productNames);
    
    // Find exact matches
    products.forEach(product => {
      if (product.title && productNames.some(name => 
        product.title.toLowerCase().includes(name.toLowerCase().replace(' edp 100ml', '').replace(' edp', '')))) {
        foundProducts.push(product);
        console.log(`Found exact product for comparison: ${product.title}`);
      }
    });
    
    return foundProducts;
  }
}

export const ragService = RAGService.getInstance();