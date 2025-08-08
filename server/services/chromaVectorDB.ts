import { embeddingService } from './embedding.js';
import { fileStorageService } from './fileStorage.js';

export interface VectorDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
}

export class ChromaVectorDBService {
  private static instance: ChromaVectorDBService;
  private client: any = null;
  private documentsCollection: any = null;
  private productsCollection: any = null;
  private isInitialized = false;
  private inMemoryStore: Map<string, VectorDocument[]> = new Map();

  private constructor() {
    this.inMemoryStore.set('documents', []);
    this.inMemoryStore.set('products', []);
  }

  public static getInstance(): ChromaVectorDBService {
    if (!ChromaVectorDBService.instance) {
      ChromaVectorDBService.instance = new ChromaVectorDBService();
    }
    return ChromaVectorDBService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing ChromaDB...');
      
      // Initialize embedding service first
      await embeddingService.initialize();

      // Try to initialize ChromaDB
      try {
        const { ChromaApi } = await import('chromadb');
        
        // Create ChromaDB client
        this.client = new ChromaApi({
          path: process.env.CHROMA_HOST || "http://localhost:8000"
        });

        // Test connection and create collections
        await this.setupCollections();
        console.log('ChromaDB initialized successfully');
      } catch (chromaError) {
        console.log('ChromaDB not available - using MemoryVectorStore with file persistence (recommended for Replit)');
        this.client = null;
      }

      this.isInitialized = true;
      console.log('Vector database service initialized');
    } catch (error) {
      console.error('Failed to initialize vector database service:', error);
      this.isInitialized = true; // Continue with fallback
    }
  }

  private async setupCollections(): Promise<void> {
    if (!this.client) return;

    try {
      // Create or get documents collection
      this.documentsCollection = await this.client.getOrCreateCollection({
        name: "documents",
        metadata: { 
          description: "Knowledge base documents including PDFs, Word docs, Excel files, CSV data" 
        }
      });

      // Create or get products collection
      this.productsCollection = await this.client.getOrCreateCollection({
        name: "products", 
        metadata: { 
          description: "E-commerce product catalog from merchant feeds and manual entries" 
        }
      });

      console.log('ChromaDB collections created successfully');
    } catch (error) {
      console.error('Failed to setup ChromaDB collections:', error);
      this.client = null;
    }
  }

  public async addDocuments(documents: VectorDocument[]): Promise<void> {
    if (!this.isInitialized) await this.initialize();

    const processedDocs = await this.ensureEmbeddings(documents);

    // Store in ChromaDB if available
    if (this.client && this.documentsCollection) {
      try {
        await this.documentsCollection.add({
          ids: processedDocs.map(doc => doc.id),
          embeddings: processedDocs.map(doc => doc.embedding!),
          documents: processedDocs.map(doc => doc.content),
          metadatas: processedDocs.map(doc => doc.metadata)
        });
        console.log(`Added ${processedDocs.length} documents to ChromaDB`);
      } catch (error) {
        console.error('Failed to add documents to ChromaDB:', error);
      }
    }

    // Always store in memory as backup
    const memoryDocs = this.inMemoryStore.get('documents') || [];
    memoryDocs.push(...processedDocs);
    this.inMemoryStore.set('documents', memoryDocs);

    // Store embeddings to file system for persistence
    for (const doc of processedDocs) {
      await fileStorageService.storeEmbeddings(
        [{ embedding: doc.embedding, content: doc.content, metadata: doc.metadata }], 
        doc.id, 
        'document'
      );
    }
  }

  public async addProducts(products: VectorDocument[]): Promise<void> {
    if (!this.isInitialized) await this.initialize();

    const processedProducts = await this.ensureEmbeddings(products);

    // Store in ChromaDB if available
    if (this.client && this.productsCollection) {
      try {
        await this.productsCollection.add({
          ids: processedProducts.map(prod => prod.id),
          embeddings: processedProducts.map(prod => prod.embedding!),
          documents: processedProducts.map(prod => prod.content),
          metadatas: processedProducts.map(prod => prod.metadata)
        });
        console.log(`Added ${processedProducts.length} products to ChromaDB`);
      } catch (error) {
        console.error('Failed to add products to ChromaDB:', error);
      }
    }

    // Always store in memory as backup
    const memoryProducts = this.inMemoryStore.get('products') || [];
    memoryProducts.push(...processedProducts);
    this.inMemoryStore.set('products', memoryProducts);

    // Store embeddings to file system for persistence
    for (const product of processedProducts) {
      await fileStorageService.storeEmbeddings(
        [{ embedding: product.embedding, content: product.content, metadata: product.metadata }], 
        product.id, 
        'product'
      );
    }
  }

  public async searchDocuments(query: string, limit: number = 5): Promise<VectorDocument[]> {
    if (!this.isInitialized) await this.initialize();

    const queryEmbedding = await embeddingService.embedText(query);

    // Try ChromaDB first
    if (this.client && this.documentsCollection) {
      try {
        const results = await this.documentsCollection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: limit
        });

        return this.formatChromaResults(results);
      } catch (error) {
        console.error('ChromaDB search failed, falling back to memory search:', error);
      }
    }

    // Fallback to memory search
    return this.searchInMemory('documents', queryEmbedding, limit);
  }

  public async searchProducts(query: string, limit: number = 5): Promise<VectorDocument[]> {
    if (!this.isInitialized) await this.initialize();

    const queryEmbedding = await embeddingService.embedText(query);

    // Try ChromaDB first
    if (this.client && this.productsCollection) {
      try {
        const results = await this.productsCollection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: limit
        });

        return this.formatChromaResults(results);
      } catch (error) {
        console.error('ChromaDB search failed, falling back to memory search:', error);
      }
    }

    // Fallback to memory search
    return this.searchInMemory('products', queryEmbedding, limit);
  }

  public async clearDocuments(): Promise<void> {
    if (this.client && this.documentsCollection) {
      try {
        await this.client.deleteCollection({ name: "documents" });
        this.documentsCollection = await this.client.getOrCreateCollection({
          name: "documents",
          metadata: { description: "Knowledge base documents" }
        });
      } catch (error) {
        console.error('Failed to clear documents in ChromaDB:', error);
      }
    }

    this.inMemoryStore.set('documents', []);
    console.log('Document embeddings cleared');
  }

  public async clearProducts(): Promise<void> {
    if (this.client && this.productsCollection) {
      try {
        await this.client.deleteCollection({ name: "products" });
        this.productsCollection = await this.client.getOrCreateCollection({
          name: "products",
          metadata: { description: "Product catalog" }
        });
      } catch (error) {
        console.error('Failed to clear products in ChromaDB:', error);
      }
    }

    this.inMemoryStore.set('products', []);
    console.log('Product embeddings cleared');
  }

  public async clearAll(): Promise<void> {
    await this.clearDocuments();
    await this.clearProducts();
  }

  private async ensureEmbeddings(documents: VectorDocument[]): Promise<VectorDocument[]> {
    const processedDocs: VectorDocument[] = [];

    for (const doc of documents) {
      if (!doc.embedding) {
        const embedding = await embeddingService.embedText(doc.content);
        processedDocs.push({ ...doc, embedding });
      } else {
        processedDocs.push(doc);
      }
    }

    return processedDocs;
  }

  private formatChromaResults(results: any): VectorDocument[] {
    const documents: VectorDocument[] = [];

    if (results.ids && results.ids[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        documents.push({
          id: results.ids[0][i],
          content: results.documents[0][i],
          metadata: results.metadatas[0][i] || {},
          embedding: results.embeddings ? results.embeddings[0][i] : undefined
        });
      }
    }

    return documents;
  }

  private searchInMemory(collection: string, queryEmbedding: number[], limit: number): VectorDocument[] {
    const documents = this.inMemoryStore.get(collection) || [];
    
    const similarities = documents.map(doc => {
      if (!doc.embedding) return { doc, similarity: 0 };
      
      const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
      return { doc, similarity };
    });

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(item => item.doc);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  public getStatus(): { 
    chromaAvailable: boolean; 
    documentsCount: number; 
    productsCount: number; 
    memoryStorageActive: boolean 
  } {
    return {
      chromaAvailable: !!this.client,
      documentsCount: (this.inMemoryStore.get('documents') || []).length,
      productsCount: (this.inMemoryStore.get('products') || []).length,
      memoryStorageActive: true
    };
  }
}

export const chromaVectorDBService = ChromaVectorDBService.getInstance();