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
        console.log(`RAG Service: Loaded ${allProducts.length} products from JSON storage for intelligent search`);
        if (allProducts.length > 0) {
          console.log(`First product sample: ${allProducts[0].title} (${allProducts[0].additionalFields?.product_type})`);
        }
        // Search products based on title, description, and product_type  
        console.log(`Calling searchProductsIntelligently with maxProducts=${maxProducts}`);
        const relevantProducts = await this.searchProductsIntelligently(query, allProducts, maxProducts);
        return relevantProducts;
      }

      console.log(`Searching ${consolidatedProducts.length} consolidated products intelligently`);
      
      // Use intelligent search on consolidated products
      console.log(`Calling searchProductsIntelligently with consolidatedProducts, maxProducts=${maxProducts}`);
      const relevantProducts = await this.searchProductsIntelligently(query, consolidatedProducts, maxProducts);
      
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
      'men', 'women', 'unisex', 'male', 'female', 'mens', 'womens', 'mans', 'womans',
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

  private async searchProductsIntelligently(query: string, products: any[], maxProducts: number): Promise<any[]> {
    console.log(`Starting intelligent search with maxProducts=${maxProducts}`);
    const intent = this.parseUserIntent(query);
    console.log('Parsed user intent:', JSON.stringify(intent, null, 2));
    
    const queryLower = query.toLowerCase();
    
    // Enhanced category detection for watches and accessories
    const isWatchQuery = queryLower.includes('watch') || queryLower.includes('timepiece') || 
                        queryLower.includes('chronograph') || queryLower.includes('clock');
    const isJewelryQuery = queryLower.includes('jewelry') || queryLower.includes('bracelet') || 
                          queryLower.includes('necklace') || queryLower.includes('ring');
    const isAccessoryQuery = queryLower.includes('accessory') || queryLower.includes('wallet') || 
                            queryLower.includes('bag') || queryLower.includes('leather goods');
    const isNewCollectionQuery = queryLower.includes('new') || queryLower.includes('latest') || 
                               queryLower.includes('recent') || queryLower.includes('arrival') || 
                               queryLower.includes('collection');
    
    // Detect gender-specific requests - ENHANCED DETECTION
    const hasGenderRequest = intent.categoryHints.some(hint => ['men', 'male', 'mans', 'mens', 'cologne'].includes(hint)) ||
                            intent.searchTerms.some(term => ['men', 'male', 'mans', 'mens', 'cologne'].includes(term)) ||
                            queryLower.includes('men') ||
                            queryLower.includes('cologne') ||
                            queryLower.includes("men's");
    const hasWomenRequest = intent.categoryHints.some(hint => ['women', 'female', 'womans', 'womens'].includes(hint)) ||
                           intent.searchTerms.some(term => ['women', 'female', 'womans', 'womens'].includes(term)) ||
                           queryLower.includes('women') ||
                           queryLower.includes("women's");
    
    // Enable debug logging temporarily to fix the filtering issue
    console.log('Gender detection debug:', {
      query: queryLower,
      hasGenderRequest,
      hasWomenRequest,
      categoryHints: intent.categoryHints,
      searchTerms: intent.searchTerms,
      productsLength: products.length
    });
    
    // Score products based on relevance
    const scoredProducts = products.map(product => {
      let score = 0;
      
      // Get product fields for filtering
      const titleLower = (product.title || '').toLowerCase();
      const descLower = (product.description || '').toLowerCase();
      const categoryLower = (product.additionalFields && typeof product.additionalFields === 'object' && 'product_type' in product.additionalFields ? 
                            (product.additionalFields.product_type as string || '').toLowerCase() : '');
      const brandLower = (product.brand || '').toLowerCase();
      
      // Category-specific scoring logic
      if (isWatchQuery) {
        // Prioritize watches and timepieces
        if (categoryLower.includes('watch') || categoryLower.includes('timepiece') || 
            titleLower.includes('watch') || titleLower.includes('timepiece')) {
          score += 100; // High priority for watch queries
        } else if (categoryLower.includes('accessory') || categoryLower.includes('jewelry')) {
          score += 20; // Secondary priority for accessories
        } else {
          score += 1; // Very low score for non-watches
        }
      } else if (isJewelryQuery || isAccessoryQuery) {
        // Prioritize jewelry and accessories
        if (categoryLower.includes('jewelry') || categoryLower.includes('accessory') || 
            categoryLower.includes('bracelet') || categoryLower.includes('wallet') ||
            titleLower.includes('bracelet') || titleLower.includes('wallet')) {
          score += 100; // High priority for jewelry/accessory queries
        } else {
          score += 1; // Low score for non-accessories
        }
      } else {
        // Default fragrance prioritization
        if (categoryLower.includes('fragrance') || categoryLower.includes('perfume') || 
            titleLower.includes('edp') || titleLower.includes('edt') || titleLower.includes('cologne') || 
            titleLower.includes('perfume') || titleLower.includes('fragrance')) {
          score += 10; // Base score for fragrance products
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
      
      // Gender-specific filtering and scoring - MOST ACCURATE VERSION
      const productTypeField = (product.additionalFields?.product_type || '').toLowerCase();
      const isWomensProduct = productTypeField.includes('women') || titleLower.includes('for women') || 
                             (titleLower.includes('women') && !titleLower.includes('for men'));
      const isMensProduct = (productTypeField.includes('men') && !productTypeField.includes('women')) || 
                           (titleLower.includes('for men') && !titleLower.includes('women')) || 
                           (titleLower.includes('cologne') && !titleLower.includes('women'));
      const isUnisexProduct = productTypeField.includes('unisex');
      
      // FINAL DEBUG: Show what's happening with scoring for first few products
      if (products.indexOf(product) < 2) {
        console.log(`\n=== FINAL DEBUG FOR ${product.title} ===`);
        console.log(`Before gender filtering - Score: ${score}`);
        console.log(`Product type: ${productTypeField}`);
        console.log(`Is men's: ${isMensProduct}, Is women's: ${isWomensProduct}`);
        console.log(`Gender request conditions: hasGenderRequest=${hasGenderRequest}, hasWomenRequest=${hasWomenRequest}`);
      }
      
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
      
      // Search terms matching
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
      if (products.indexOf(product) < 2) {
        console.log(`Final score for ${product.title}: ${score}`);
        console.log(`=== END DEBUG ===\n`);
      }
      
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
    
    const minScore = isDealQuery ? 5 : 0; // Lower threshold for deal queries
    
    // Return products with score > minScore, sorted by score
    console.log(`Before final filtering: ${scoredProducts.filter(p => p.searchScore > minScore).length} products have score > ${minScore}`);
    const filteredProducts = scoredProducts
      .filter(product => product.searchScore > minScore)
      .sort((a, b) => b.searchScore - a.searchScore)
      .slice(0, maxProducts);
    console.log(`After final filtering: ${filteredProducts.length} products remain`);
    
    console.log(`Intelligent search found ${filteredProducts.length} products matching intent`);
    
    // Apply offer pricing to products before returning
    const productsWithOffers = await this.applyOfferPricing(filteredProducts);
    console.log(`Applied offer pricing to ${productsWithOffers.length} products`);
    
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