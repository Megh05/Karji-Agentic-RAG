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
        uploadedAt: document.uploadedAt?.toISOString(),
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

  public async findRelevantContext(query: string, options?: {
    maxDocuments?: number;
    maxProducts?: number;
    similarityThreshold?: number;
  }): Promise<RAGContext> {
    if (!this.isInitialized) await this.initialize();

    const { 
      maxDocuments = 3, 
      maxProducts = 4, 
      similarityThreshold = 0.1 
    } = options || {};

    try {
      // Use vector search if available
      const [vectorDocs, vectorProducts] = await Promise.all([
        vectorDBService.searchDocuments(query, maxDocuments),
        vectorDBService.searchProducts(query, maxProducts)
      ]);

      if (vectorDocs.length > 0 || vectorProducts.length > 0) {
        console.log(`Vector search found ${vectorDocs.length} documents and ${vectorProducts.length} products`);
        
        // Get full document and product data
        const documents = await storage.getDocuments();
        const products = await storage.getProducts();

        const relevantDocs = documents.filter(doc => 
          vectorDocs.some(vDoc => vDoc.id === doc.id)
        ).map(doc => ({ ...doc, similarity: 0.8 })); // High similarity for vector matches

        // For products, use consolidated file if available
        const consolidatedProducts = await this.searchConsolidatedProducts(query, maxProducts);
        const relevantProducts = consolidatedProducts.length > 0 
          ? consolidatedProducts // Already processed by intelligent search
          : products.filter(product => 
              vectorProducts.some(vProduct => vProduct.id === product.id)
            ).map(product => ({ ...product, similarity: 0.8 }));

        return {
          documents: relevantDocs,
          products: relevantProducts,
          relevantChunks: [...vectorDocs, ...vectorProducts]
        };
      }

      // Fallback to basic text similarity
      console.log('Falling back to basic text similarity search');
      return this.basicSimilaritySearch(query, similarityThreshold, maxDocuments, maxProducts);

    } catch (error) {
      console.error('Error in vector search, falling back to basic similarity:', error);
      return this.basicSimilaritySearch(query, similarityThreshold, maxDocuments, maxProducts);
    }
  }

  private async searchConsolidatedProducts(query: string, maxProducts: number): Promise<any[]> {
    try {
      const { langchainRAGService } = await import('./langchainRAG.js');
      const consolidatedProducts = await langchainRAGService.loadConsolidatedProducts();
      
      if (consolidatedProducts.length === 0) {
        console.log('No consolidated products found, falling back to intelligent product search');
        const allProducts = await storage.getProducts();
        // Search products based on title, description, and product_type
        const relevantProducts = this.searchProductsIntelligently(query, allProducts, maxProducts);
        return relevantProducts;
      }

      console.log(`Searching ${consolidatedProducts.length} consolidated products intelligently`);
      
      // Use intelligent search on consolidated products
      const relevantProducts = this.searchProductsIntelligently(query, consolidatedProducts, maxProducts);
      
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
    maxProducts: number
  ): Promise<RAGContext> {
    const documents = await storage.getDocuments();
    
    // Use consolidated product file for product search with strict limits
    const products = await this.searchConsolidatedProducts(query, maxProducts);

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

  private parseUserIntent(query: string): {
    searchTerms: string[];
    priceFilter: { min?: number; max?: number } | null;
    categoryHints: string[];
    brandPreferences: string[];
    qualityLevel: 'budget' | 'mid-range' | 'luxury' | null;
  } {
    const queryLower = query.toLowerCase();
    
    // Extract price information using intelligent parsing
    let priceFilter: { min?: number; max?: number } | null = null;
    
    // Find all numbers in the query
    const numbers = query.match(/\d+/g)?.map(n => parseInt(n)) || [];
    
    // Price filter patterns - more flexible approach
    const priceKeywords = ['aed', 'dirham', 'price', 'cost', 'budget'];
    const rangeKeywords = ['range', 'between', 'from', 'to', 'and'];
    const limitKeywords = ['under', 'below', 'less', 'maximum', 'max', 'up to'];
    
    const hasPriceContext = priceKeywords.some(keyword => queryLower.includes(keyword));
    const hasRangeContext = rangeKeywords.some(keyword => queryLower.includes(keyword));
    const hasLimitContext = limitKeywords.some(keyword => queryLower.includes(keyword));
    
    if (hasPriceContext && numbers.length > 0) {
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
      'men', 'women', 'unisex', 'male', 'female', 'mens', 'womens',
      'luxury', 'premium', 'designer', 'elegant', 'sophisticated',
      'gift', 'present', 'special', 'occasion'
    ];
    
    // Add semantic understanding for vague terms
    const vaguePhrases = {
      'something nice': ['luxury', 'premium', 'elegant'],
      'good quality': ['premium', 'luxury'],
      'affordable': ['budget', 'cheap', 'inexpensive'],
      'expensive': ['luxury', 'premium', 'designer'],
    };
    
    // Check for vague phrases and expand them
    Object.entries(vaguePhrases).forEach(([phrase, expansions]) => {
      if (queryLower.includes(phrase)) {
        categoryKeywords.push(...expansions);
      }
    });
    
    const categoryHints = categoryKeywords.filter(keyword => 
      queryLower.includes(keyword) || queryLower.includes(keyword + 's')
    );
    
    // Extract meaningful search terms (excluding price and range keywords)
    const excludeWords = [...priceKeywords, ...rangeKeywords, ...limitKeywords, 'show', 'me', 'find', 'get', 'i', 'want', 'need'];
    const searchTerms = queryLower
      .split(/\s+/)
      .filter(word => 
        word.length > 2 && 
        !excludeWords.includes(word) && 
        !numbers.includes(parseInt(word))
      );
    
    // Extract brand preferences
    const commonBrands = [
      'michael kors', 'calvin klein', 'roberto cavalli', 'dunhill', 'lencia',
      'fabian', 'police', 'cerruti', 'boadicea', 'nasamat', 'zenology'
    ];
    
    const brandPreferences = commonBrands.filter(brand => 
      queryLower.includes(brand.toLowerCase())
    );
    
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
    
    return { searchTerms, priceFilter, categoryHints, brandPreferences, qualityLevel };
  }

  private searchProductsIntelligently(query: string, products: any[], maxProducts: number): any[] {
    const intent = this.parseUserIntent(query);
    console.log('Parsed user intent:', JSON.stringify(intent, null, 2));
    
    // Score products based on relevance
    const scoredProducts = products.map(product => {
      let score = 0;
      
      // Apply price filter first (strict filtering)
      if (intent.priceFilter && product.price) {
        const productPrice = parseFloat(product.price.replace(/[^\d.]/g, ''));
        
        const withinMin = !intent.priceFilter.min || productPrice >= intent.priceFilter.min;
        const withinMax = !intent.priceFilter.max || productPrice <= intent.priceFilter.max;
        
        if (!withinMin || !withinMax) {
          return { ...product, searchScore: 0 }; // Exclude if outside price range
        }
        score += 5; // Bonus for matching price criteria
      }
      
      // Search terms matching
      const titleLower = (product.title || '').toLowerCase();
      const descLower = (product.description || '').toLowerCase();
      const categoryLower = (product.additionalFields?.product_type || '').toLowerCase();
      const brandLower = (product.brand || '').toLowerCase();
      
      intent.searchTerms.forEach(term => {
        if (titleLower.includes(term)) score += 4; // Title matches are most important
        if (brandLower.includes(term)) score += 3; // Brand matches are important
        if (categoryLower.includes(term)) score += 3; // Category matches
        if (descLower.includes(term)) score += 2; // Description matches
      });
      
      // Category hints bonus
      intent.categoryHints.forEach(hint => {
        if (titleLower.includes(hint)) score += 2;
        if (categoryLower.includes(hint)) score += 3;
        if (descLower.includes(hint)) score += 1;
      });
      
      // Brand preference bonus
      intent.brandPreferences.forEach(brand => {
        if (brandLower.includes(brand)) score += 5; // Strong brand preference
        if (titleLower.includes(brand)) score += 3;
      });
      
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
      
      return { ...product, searchScore: score };
    });
    
    // Return products with score > 0, sorted by score
    const filteredProducts = scoredProducts
      .filter(product => product.searchScore > 0)
      .sort((a, b) => b.searchScore - a.searchScore)
      .slice(0, maxProducts);
    
    console.log(`Intelligent search found ${filteredProducts.length} products matching intent`);
    return filteredProducts;
  }

  public async clearIndex(): Promise<void> {
    try {
      await vectorDBService.clearCollection('documents');
      await vectorDBService.clearCollection('products');
      console.log('Vector index cleared');
    } catch (error) {
      console.error('Error clearing index:', error);
    }
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
}

export const ragService = RAGService.getInstance();