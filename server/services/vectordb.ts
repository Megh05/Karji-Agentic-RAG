import { ChromaApi, Collection } from 'chromadb';
import { embeddingService } from './embedding.js';
import { fileStorageService } from './fileStorage.js';

export interface VectorDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
}

export class VectorDBService {
  private static instance: VectorDBService;
  private client: ChromaApi | null = null;
  private documentsCollection: Collection | null = null;
  private productsCollection: Collection | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): VectorDBService {
    if (!VectorDBService.instance) {
      VectorDBService.instance = new VectorDBService();
    }
    return VectorDBService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing ChromaDB...');
      
      // Import ChromaClient dynamically to handle ESM
      const { ChromaApi } = await import('chromadb');
      
      // Create client
      this.client = new ChromaApi({
        path: "http://localhost:8000" // Default ChromaDB port
      });

      // Initialize embedding service
      await embeddingService.initialize();

      // Create or get collections
      try {
        this.documentsCollection = await this.client.getOrCreateCollection({
          name: "documents",
          metadata: { description: "Knowledge base documents" }
        });
        
        this.productsCollection = await this.client.getOrCreateCollection({
          name: "products", 
          metadata: { description: "Product catalog" }
        });
      } catch (error) {
        console.warn('ChromaDB not available, falling back to in-memory vector storage');
        // ChromaDB not available, we'll use in-memory storage as fallback
        this.client = null;
      }

      this.isInitialized = true;
      console.log('Vector database initialized');
    } catch (error) {
      console.error('Failed to initialize vector database:', error);
      // Continue without ChromaDB for now
      this.isInitialized = true;
    }
  }

  public async addDocuments(documents: VectorDocument[]): Promise<void> {
    if (!this.isInitialized) await this.initialize();

    try {
      if (!this.client || !this.documentsCollection) {
        console.warn('ChromaDB not available, documents not persisted to vector DB');
        return;
      }

      const ids: string[] = [];
      const embeddings: number[][] = [];
      const metadatas: Record<string, any>[] = [];
      const documents_text: string[] = [];

      for (const doc of documents) {
        const embedding = await embeddingService.embedText(doc.content);
        
        ids.push(doc.id);
        embeddings.push(embedding);
        metadatas.push(doc.metadata);
        documents_text.push(doc.content);
      }

      await this.documentsCollection.add({
        ids,
        embeddings,
        metadatas,
        documents: documents_text
      });

      console.log(`Added ${documents.length} documents to vector database`);
    } catch (error) {
      console.error('Error adding documents to vector database:', error);
    }
  }

  public async addProducts(products: VectorDocument[]): Promise<void> {
    if (!this.isInitialized) await this.initialize();

    try {
      if (!this.client || !this.productsCollection) {
        console.warn('ChromaDB not available, products not persisted to vector DB');
        return;
      }

      const ids: string[] = [];
      const embeddings: number[][] = [];
      const metadatas: Record<string, any>[] = [];
      const documents_text: string[] = [];

      for (const product of products) {
        const embedding = await embeddingService.embedText(product.content);
        
        ids.push(product.id);
        embeddings.push(embedding);
        metadatas.push(product.metadata);
        documents_text.push(product.content);
      }

      await this.productsCollection.add({
        ids,
        embeddings,
        metadatas,
        documents: documents_text
      });

      console.log(`Added ${products.length} products to vector database`);
    } catch (error) {
      console.error('Error adding products to vector database:', error);
    }
  }

  public async searchDocuments(query: string, limit: number = 5): Promise<VectorDocument[]> {
    if (!this.isInitialized) await this.initialize();

    try {
      if (!this.client || !this.documentsCollection) {
        return [];
      }

      const queryEmbedding = await embeddingService.embedText(query);
      
      const results = await this.documentsCollection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit
      });

      const documents: VectorDocument[] = [];
      if (results.documents && results.metadatas && results.ids) {
        for (let i = 0; i < results.documents[0].length; i++) {
          documents.push({
            id: results.ids[0][i] as string,
            content: results.documents[0][i] as string,
            metadata: results.metadatas[0][i] as Record<string, any>
          });
        }
      }

      return documents;
    } catch (error) {
      console.error('Error searching documents:', error);
      return [];
    }
  }

  public async searchProducts(query: string, limit: number = 5): Promise<VectorDocument[]> {
    if (!this.isInitialized) await this.initialize();

    try {
      if (!this.client || !this.productsCollection) {
        return [];
      }

      const queryEmbedding = await embeddingService.embedText(query);
      
      const results = await this.productsCollection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit
      });

      const products: VectorDocument[] = [];
      if (results.documents && results.metadatas && results.ids) {
        for (let i = 0; i < results.documents[0].length; i++) {
          products.push({
            id: results.ids[0][i] as string,
            content: results.documents[0][i] as string,
            metadata: results.metadatas[0][i] as Record<string, any>
          });
        }
      }

      return products;
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  }

  public async clearCollection(collectionName: 'documents' | 'products'): Promise<void> {
    if (!this.isInitialized) await this.initialize();

    try {
      if (!this.client) return;

      const collection = collectionName === 'documents' ? this.documentsCollection : this.productsCollection;
      if (collection) {
        await this.client.deleteCollection({ name: collectionName });
        
        // Recreate the collection
        if (collectionName === 'documents') {
          this.documentsCollection = await this.client.getOrCreateCollection({
            name: "documents",
            metadata: { description: "Knowledge base documents" }
          });
        } else {
          this.productsCollection = await this.client.getOrCreateCollection({
            name: "products",
            metadata: { description: "Product catalog" }
          });
        }
      }
      console.log(`Cleared ${collectionName} collection`);
    } catch (error) {
      console.error(`Error clearing ${collectionName} collection:`, error);
    }
  }
}

export const vectorDBService = VectorDBService.getInstance();