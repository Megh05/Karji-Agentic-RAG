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
      maxProducts = 5, 
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
          ? consolidatedProducts.slice(0, maxProducts).map(product => ({ ...product, similarity: 0.8 }))
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
        console.log('No consolidated products found, falling back to storage with limits');
        const allProducts = await storage.getProducts();
        // Limit to first few products to avoid token overflow
        return allProducts.slice(0, maxProducts);
      }

      const queryLower = query.toLowerCase();
      
      const relevantProducts = consolidatedProducts
        .map(product => ({
          ...product,
          similarity: this.calculateBasicSimilarity(query, product.content)
        }))
        .filter(product => product.similarity > 0.1)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, maxProducts);

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
    const products = await this.searchConsolidatedProducts(query, Math.min(maxProducts, 3));

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