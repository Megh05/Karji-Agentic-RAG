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
          console.log(`First product sample: ${allProducts[0].title} (${(allProducts[0] as any).additionalFields?.product_type})`);
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
    
    // Extract brand preferences - include Tom Ford and other luxury brands
    const commonBrands = [
      'tom ford', 'michael kors', 'calvin klein', 'roberto cavalli', 'dunhill', 'lencia',
      'fabian', 'police', 'cerruti', 'boadicea', 'nasamat', 'zenology', 'hugo boss',
      'emporio armani', 'giorgio armani', 'versace', 'gucci', 'prada', 'dior', 'chanel',
      'dolce gabbana', 'jean paul gaultier', 'yves saint laurent', 'cartier', 'elie saab'
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
    
    console.log('Price parsing result:', {
      query,
      numbers,
      priceFilter,
      hasPriceContext,
      hasRangeContext,
      dashRangeMatch: !!dashRangeMatch
    });
    
    return { searchTerms, priceFilter, categoryHints, brandPreferences, qualityLevel };
  }

  // Levenshtein distance for fuzzy matching
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator  // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private searchProductsWithIntent(query: string, products: any[], intent: any, maxProducts: number): any[] {
    console.log(`Searching with provided intent for ${maxProducts} products`);
    
    // Gender-aware filtering debug info
    console.log('Gender detection debug:', {
      query,
      hasGenderRequest: intent.categoryHints.some((hint: string) => ['men', 'women', 'male', 'female'].includes(hint.toLowerCase())),
      hasWomenRequest: intent.categoryHints.some((hint: string) => ['women', 'female'].includes(hint.toLowerCase())),
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
      
      // Gender filtering
      const hasGenderRequest = intent.categoryHints.some((hint: string) => ['men', 'women', 'male', 'female'].includes(hint.toLowerCase()));
      const hasWomenRequest = intent.categoryHints.some((hint: string) => ['women', 'female'].includes(hint.toLowerCase()));
      
      if (hasGenderRequest) {
        const productType = (product as any).additionalFields?.product_type?.toLowerCase() || '';
        const isMens = productType.includes('men') && !productType.includes('women');
        const isWomens = productType.includes('women') && !productType.includes('men');
        const isUnisex = productType.includes('unisex') || (!isMens && !isWomens);
        
        if (hasWomenRequest && !isWomens && !isUnisex) {
          score = 0; // Exclude men's products for women's requests
        } else if (!hasWomenRequest && hasGenderRequest && !isMens && !isUnisex) {
          score = 0; // Exclude women's products for men's requests
        } else if (hasWomenRequest && (isWomens || isUnisex)) {
          score += 200; // Boost women's and unisex products
        } else if (!hasWomenRequest && hasGenderRequest && (isMens || isUnisex)) {
          score += 200; // Boost men's and unisex products
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
    const isAccessoryQuery = queryLower.includes('accessory') || queryLower.includes('accessories') || queryLower.includes('wallet') || 
                            queryLower.includes('bag') || queryLower.includes('leather goods') || queryLower.includes('bracelet') ||
                            queryLower.includes('jewelry') || queryLower.includes('watch') || queryLower.includes('timepiece');
    
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
      
      // Category-specific scoring logic - BRAND QUERIES GET HIGHEST PRIORITY
      if (isBrandQuery) {
        // For brand-specific queries, prioritize products from that brand
        const queryBrands = ['aigner', 'fabian', 'lencia', 'police', 'roberto cavalli', 'tom ford'];
        const matchingBrand = queryBrands.find(brand => 
          queryLower.includes(brand) || titleLower.includes(brand) || brandLower.includes(brand)
        );
        
        if (matchingBrand && (brandLower.includes(matchingBrand) || titleLower.includes(matchingBrand))) {
          // FIRST: Check if this is a jewelry gift set disguised as a perfume gift set
          // Apply penalty BEFORE brand boost to ensure exclusion
          let isJewelryGiftSet = false;
          if (queryLower.includes('perfume') || queryLower.includes('fragrance') || queryLower.includes('edp') || queryLower.includes('edt')) {
            if (categoryLower.includes('gift set') && 
                (titleLower.includes('bracelet') || titleLower.includes('necklace') || 
                 titleLower.includes('jewelry') || titleLower.includes('watch') || titleLower.includes('timepiece'))) {
              // This is jewelry, not perfume - exclude it entirely
              score -= 3000; // Massive penalty to ensure exclusion
              console.log(`Excluding jewelry gift set: ${product.title} - score reduced to ${score}`);
              isJewelryGiftSet = true;
            }
          }
          
          // Only apply brand boost if it's not a jewelry gift set
          if (!isJewelryGiftSet) {
            score += 600; // Maximum priority for brand matches
          }
          
          // Additional boost for brand + category matches (e.g., "Aigner perfumes")
          if (queryLower.includes('perfume') || queryLower.includes('fragrance') || queryLower.includes('edp') || queryLower.includes('edt')) {
            if (categoryLower.includes('fragrance') || categoryLower.includes('perfume') || 
                titleLower.includes('edp') || titleLower.includes('edt')) {
              score += 200; // Extra boost for brand + perfume matches
              
              // Extra boost for actual perfume bottles (not gift sets with jewelry)
              if (titleLower.includes('edp') || titleLower.includes('edt') || 
                  titleLower.includes('perfume') || titleLower.includes('fragrance')) {
                score += 100; // Additional boost for actual perfume products
              }
            } else {
              // Heavily penalize non-perfume products when perfume is specifically requested
              score -= 400; // Major penalty for category mismatch
            }
          }
          
          // Additional boost for brand + accessory matches (e.g., "Aigner accessories")
          if (queryLower.includes('accessory') || queryLower.includes('accessories') || 
              queryLower.includes('bracelet') || queryLower.includes('watch') || queryLower.includes('jewelry')) {
            if (categoryLower.includes('accessory') || categoryLower.includes('jewelry') || 
                categoryLower.includes('bracelet') || categoryLower.includes('watch')) {
              score += 200; // Extra boost for brand + accessory matches
            } else {
              // Heavily penalize non-accessory products when accessories are specifically requested
              score -= 400; // Major penalty for category mismatch
            }
          }
        } else {
          score += 1; // Very low score for non-matching brands
        }
      } else if (isMensAccessoriesQuery) {
        // For "men's accessories" queries, prioritize men's accessories above everything else
        if (categoryLower.includes('accessory') || categoryLower.includes('accessories') || categoryLower.includes('jewelry') || 
            categoryLower.includes('bracelet') || categoryLower.includes('watch') || 
            categoryLower.includes('timepiece') || categoryLower.includes('wallet')) {
          if (productTypeField.includes('men') || titleLower.includes('men') || titleLower.includes('mens')) {
            score += 500; // Maximum priority for men's accessories
          } else {
            score += 300; // High priority for general accessories
          }
        } else if (categoryLower.includes('fragrance') || categoryLower.includes('perfume')) {
          score += 1; // Minimal score for fragrances when men's accessories are requested
        } else {
          score += 5; // Low score for other products
        }
      } else if (isWatchQuery) {
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
            categoryLower.includes('watch') || categoryLower.includes('timepiece') ||
            titleLower.includes('bracelet') || titleLower.includes('wallet') ||
            titleLower.includes('watch') || titleLower.includes('timepiece')) {
          score += 200; // Very high priority for accessory queries
        } else if (categoryLower.includes('fragrance') || categoryLower.includes('perfume')) {
          score += 5; // Very low score for fragrances when accessories are requested
        } else {
          score += 1; // Minimal score for other products
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
}

export const ragService = RAGService.getInstance();