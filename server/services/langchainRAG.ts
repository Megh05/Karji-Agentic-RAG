import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import { chromaVectorDBService } from './chromaVectorDB.js';
import { fileStorageService } from './fileStorage.js';
import fs from "fs";
import path from "path";

export interface ProcessedDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  chunks: Document[];
}

export class LangchainRAGService {
  private static instance: LangchainRAGService;
  private textSplitter: RecursiveCharacterTextSplitter;
  private embeddings!: HuggingFaceTransformersEmbeddings;
  private vectorStore!: MemoryVectorStore;
  private isInitialized = false;
  private lastVectorSave: number = 0;
  private storedDocuments: Document[] = [];

  private constructor() {
    // Initialize text splitter for document chunking
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", ".", "!", "?", ",", " ", ""]
    });
  }

  public static getInstance(): LangchainRAGService {
    if (!LangchainRAGService.instance) {
      LangchainRAGService.instance = new LangchainRAGService();
    }
    return LangchainRAGService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing Langchain RAG service...');
      
      // Initialize HuggingFace Transformers embeddings (local)
      this.embeddings = new HuggingFaceTransformersEmbeddings({
        modelName: "Xenova/all-MiniLM-L6-v2",
      });

      // Initialize memory vector store
      this.vectorStore = new MemoryVectorStore(this.embeddings);
      
      // Load persisted vector store data if exists
      await this.loadPersistedVectorStore();

      // Initialize ChromaDB service (graceful fallback to MemoryVectorStore)
      await chromaVectorDBService.initialize();
      
      this.isInitialized = true;
      console.log('Langchain RAG service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Langchain RAG service:', error);
      throw error;
    }
  }

  public async processDocument(content: string, metadata: Record<string, any>): Promise<ProcessedDocument> {
    if (!this.isInitialized) await this.initialize();

    try {
      // Split document into chunks using Langchain
      const docs = await this.textSplitter.createDocuments([content], [metadata]);
      
      const processedDoc: ProcessedDocument = {
        id: this.sanitizeFileName(metadata.id || `doc_${Date.now()}`),
        content,
        metadata,
        chunks: docs
      };

      // Store chunks in vector database
      await this.vectorStore.addDocuments(docs);
      this.storedDocuments.push(...docs);
      
      // Also store in ChromaDB for persistence
      const vectorDocs = docs.map((doc, index) => ({
        id: `${processedDoc.id}_chunk_${index}`,
        content: doc.pageContent,
        metadata: { ...doc.metadata, chunkIndex: index, parentId: processedDoc.id }
      }));

      await chromaVectorDBService.addDocuments(vectorDocs);

      // Save vector store state periodically for documents too
      const currentTime = Date.now();
      if (!this.lastVectorSave || currentTime - this.lastVectorSave > 30000) { // Save every 30 seconds
        await this.saveVectorStoreState();
        this.lastVectorSave = currentTime;
      }

      // Only store processed document locally if it's not a product (to avoid excessive file creation)
      if (metadata.type !== 'product') {
        await this.saveProcessedDocument(processedDoc);
      } else {
        console.log(`Product processed in memory: ${metadata.title || processedDoc.id}`);
      }
      
      console.log(`Processed document: ${metadata.name || 'Unknown'} into ${docs.length} chunks`);
      return processedDoc;
    } catch (error) {
      console.error('Error processing document:', error);
      throw error;
    }
  }

  public async processProduct(product: any): Promise<ProcessedDocument> {
    if (!this.isInitialized) await this.initialize();

    try {
      // Create searchable content for product
      const content = `${product.title}\n${product.description || ''}\nPrice: ${product.price || 'N/A'}\nBrand: ${product.brand || 'N/A'}\nAvailability: ${product.availability || 'N/A'}`;
      
      const metadata = {
        id: product.id,
        type: 'product',
        title: product.title,
        price: product.price,
        discountPrice: product.discountPrice,
        availability: product.availability,
        imageLink: product.imageLink,
        link: product.link,
        brand: product.brand
      };

      // Process product content for vector storage (no file saving)
      const docs = await this.textSplitter.createDocuments([content], [metadata]);
      
      const processedDoc: ProcessedDocument = {
        id: this.sanitizeFileName(product.id),
        content,
        metadata,
        chunks: docs
      };

      // Store chunks in vector database
      await this.vectorStore.addDocuments(docs);
      this.storedDocuments.push(...docs);
      
      // Store in ChromaDB products collection
      await chromaVectorDBService.addProducts([{
        id: product.id,
        content,
        metadata
      }]);

      // Save vector store state periodically (every 10 products processed)
      const currentTime = Date.now();
      if (!this.lastVectorSave || currentTime - this.lastVectorSave > 30000) { // Save every 30 seconds
        await this.saveVectorStoreState();
        this.lastVectorSave = currentTime;
      }

      console.log(`Product processed in memory: ${product.title}`);
      return processedDoc;
    } catch (error) {
      console.error('Error processing product:', error);
      throw error;
    }
  }

  public async similaritySearch(query: string, k: number = 5): Promise<Document[]> {
    if (!this.isInitialized) await this.initialize();

    try {
      // Perform similarity search using Langchain
      const results = await this.vectorStore.similaritySearch(query, k);
      
      // Also search ChromaDB for additional context
      const chromaResults = await chromaVectorDBService.searchDocuments(query, k);
      const chromaDocs = chromaResults.map(result => 
        new Document({
          pageContent: result.content,
          metadata: result.metadata
        })
      );

      // Combine and deduplicate results
      const allResults = [...results, ...chromaDocs];
      const uniqueResults = allResults.filter((doc, index, self) => 
        index === self.findIndex(d => d.pageContent === doc.pageContent)
      );

      return uniqueResults.slice(0, k);
    } catch (error) {
      console.error('Error performing similarity search:', error);
      return [];
    }
  }

  public async getRelevantContext(query: string, options?: {
    maxDocuments?: number;
    maxProducts?: number;
  }): Promise<{
    documents: Document[];
    products: Document[];
  }> {
    const { maxDocuments = 3, maxProducts = 5 } = options || {};

    try {
      // Search for relevant documents and products
      const allResults = await this.similaritySearch(query, maxDocuments + maxProducts);
      
      const documents = allResults
        .filter(doc => doc.metadata.type !== 'product')
        .slice(0, maxDocuments);
        
      const products = allResults
        .filter(doc => doc.metadata.type === 'product')
        .slice(0, maxProducts);

      return { documents, products };
    } catch (error) {
      console.error('Error getting relevant context:', error);
      return { documents: [], products: [] };
    }
  }

  private sanitizeFileName(fileName: string): string {
    // Remove or replace invalid characters for file names
    return fileName
      .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid chars with underscore
      .replace(/^https?:\/\//, '') // Remove http/https protocol
      .replace(/\//g, '_') // Replace forward slashes with underscores
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 100); // Limit length to prevent overly long file names
  }

  private async saveProcessedDocument(doc: ProcessedDocument): Promise<void> {
    try {
      const processedDir = path.join(process.cwd(), 'uploads', 'processed');
      if (!fs.existsSync(processedDir)) {
        fs.mkdirSync(processedDir, { recursive: true });
      }

      // Sanitize the document ID for use as filename
      const sanitizedId = this.sanitizeFileName(doc.id);
      const filePath = path.join(processedDir, `${sanitizedId}.json`);
      
      await fs.promises.writeFile(filePath, JSON.stringify(doc, null, 2), 'utf-8');
      
      console.log(`Saved processed document: ${sanitizedId}.json`);
    } catch (error) {
      console.error('Error saving processed document:', error);
    }
  }

  public async saveAllProductsVector(): Promise<void> {
    try {
      const vectorDir = path.join(process.cwd(), 'uploads', 'vectors');
      if (!fs.existsSync(vectorDir)) {
        fs.mkdirSync(vectorDir, { recursive: true });
      }

      // Get all products from JSON storage and create consolidated vector data
      const { storage } = await import('../storage.js');
      const products = await storage.getProducts();
      
      const productVectors = products.map(product => ({
        id: product.id,
        title: product.title,
        description: product.description || '',
        price: product.price,
        discountPrice: product.discountPrice,
        brand: product.brand,
        availability: product.availability,
        imageLink: product.imageLink,
        link: product.link,
        content: `${product.title}\n${product.description || ''}\nPrice: ${product.price || 'N/A'}\nBrand: ${product.brand || 'N/A'}\nAvailability: ${product.availability || 'N/A'}`,
        processedAt: new Date().toISOString()
      }));

      const vectorFilePath = path.join(vectorDir, 'products_consolidated.json');
      
      // Create backup of existing file if it exists
      const backupPath = path.join(vectorDir, `products_consolidated_backup_${Date.now()}.json`);
      if (fs.existsSync(vectorFilePath)) {
        await fs.promises.copyFile(vectorFilePath, backupPath);
      }
      
      // Write new consolidated file (replacing old one)
      await fs.promises.writeFile(vectorFilePath, JSON.stringify(productVectors, null, 2), 'utf-8');
      
      // Also save MemoryVectorStore state after updating products
      await this.saveVectorStoreState();
      
      console.log(`Updated consolidated product vectors: ${productVectors.length} products in products_consolidated.json`);
    } catch (error) {
      console.error('Error saving consolidated product vectors:', error);
    }
  }

  public async saveVectorStoreState(): Promise<void> {
    try {
      const vectorDir = path.join(process.cwd(), 'uploads', 'vectors');
      if (!fs.existsSync(vectorDir)) {
        fs.mkdirSync(vectorDir, { recursive: true });
      }

      // Save the stored documents for reconstruction
      const vectorStoreData = {
        documents: this.storedDocuments.map(doc => ({
          pageContent: doc.pageContent,
          metadata: doc.metadata
        })),
        savedAt: new Date().toISOString(),
        count: this.storedDocuments.length
      };

      const vectorStorePath = path.join(vectorDir, 'memory_vector_store.json');
      await fs.promises.writeFile(vectorStorePath, JSON.stringify(vectorStoreData, null, 2), 'utf-8');
      
      console.log(`MemoryVectorStore state saved: ${vectorStoreData.count} documents`);
    } catch (error) {
      console.error('Error saving vector store state:', error);
    }
  }

  public async loadPersistedVectorStore(): Promise<void> {
    try {
      const vectorStorePath = path.join(process.cwd(), 'uploads', 'vectors', 'memory_vector_store.json');
      
      if (!fs.existsSync(vectorStorePath)) {
        console.log('No persisted vector store found, starting fresh');
        return;
      }

      const content = await fs.promises.readFile(vectorStorePath, 'utf-8');
      const vectorStoreData = JSON.parse(content);
      
      if (vectorStoreData.documents && vectorStoreData.documents.length > 0) {
        // Reconstruct documents
        const documents = vectorStoreData.documents.map((docData: any) => 
          new Document({
            pageContent: docData.pageContent,
            metadata: docData.metadata
          })
        );

        // Add documents to vector store
        await this.vectorStore.addDocuments(documents);
        this.storedDocuments = [...documents];
        
        console.log(`MemoryVectorStore restored: ${documents.length} documents loaded`);
      } else {
        console.log('No documents found in persisted vector store');
      }
    } catch (error) {
      console.error('Error loading persisted vector store:', error);
      console.log('Starting with fresh MemoryVectorStore');
    }
  }

  public async loadConsolidatedProducts(): Promise<any[]> {
    try {
      const vectorFilePath = path.join(process.cwd(), 'uploads', 'vectors', 'products_consolidated.json');
      if (!fs.existsSync(vectorFilePath)) {
        console.log('No consolidated product vectors found');
        return [];
      }

      const content = await fs.promises.readFile(vectorFilePath, 'utf-8');
      const products = JSON.parse(content);
      
      console.log(`Loaded ${products.length} products from consolidated vector file`);
      return products;
    } catch (error) {
      console.error('Error loading consolidated products:', error);
      return [];
    }
  }

  public async loadProcessedDocuments(): Promise<ProcessedDocument[]> {
    try {
      const processedDir = path.join(process.cwd(), 'uploads', 'processed');
      if (!fs.existsSync(processedDir)) {
        return [];
      }

      const files = fs.readdirSync(processedDir).filter(file => file.endsWith('.json'));
      const documents: ProcessedDocument[] = [];

      for (const file of files) {
        const filePath = path.join(processedDir, file);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const doc = JSON.parse(content) as ProcessedDocument;
        documents.push(doc);
      }

      console.log(`Loaded ${documents.length} processed documents`);
      return documents;
    } catch (error) {
      console.error('Error loading processed documents:', error);
      return [];
    }
  }

  public async rebuildIndex(): Promise<void> {
    try {
      console.log('Rebuilding RAG index...');
      
      // Clear current vector store
      this.vectorStore = new MemoryVectorStore(this.embeddings);
      
      // Reload processed documents
      const processedDocs = await this.loadProcessedDocuments();
      
      // Add all chunks back to vector store
      for (const doc of processedDocs) {
        if (doc.chunks && doc.chunks.length > 0) {
          await this.vectorStore.addDocuments(doc.chunks);
        }
      }

      console.log(`Rebuilt index with ${processedDocs.length} documents`);
    } catch (error) {
      console.error('Error rebuilding index:', error);
    }
  }
}

export const langchainRAGService = LangchainRAGService.getInstance();