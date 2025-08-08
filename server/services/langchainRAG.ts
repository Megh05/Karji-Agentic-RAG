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
  private embeddings: HuggingFaceTransformersEmbeddings;
  private vectorStore: MemoryVectorStore;
  private isInitialized = false;

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

      // Initialize memory vector store as fallback
      this.vectorStore = new MemoryVectorStore(this.embeddings);

      // Initialize ChromaDB service
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
        id: metadata.id || `doc_${Date.now()}`,
        content,
        metadata,
        chunks: docs
      };

      // Store chunks in vector database
      await this.vectorStore.addDocuments(docs);
      
      // Also store in ChromaDB for persistence
      const vectorDocs = docs.map((doc, index) => ({
        id: `${processedDoc.id}_chunk_${index}`,
        content: doc.pageContent,
        metadata: { ...doc.metadata, chunkIndex: index, parentId: processedDoc.id }
      }));

      await chromaVectorDBService.addDocuments(vectorDocs);

      // Store processed document locally
      await this.saveProcessedDocument(processedDoc);
      
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

      const processedDoc = await this.processDocument(content, metadata);
      
      // Store in products collection
      await chromaVectorDBService.addProducts([{
        id: product.id,
        content,
        metadata
      }]);

      console.log(`Processed product: ${product.title}`);
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

  private async saveProcessedDocument(doc: ProcessedDocument): Promise<void> {
    try {
      const processedDir = path.join(process.cwd(), 'uploads', 'processed');
      if (!fs.existsSync(processedDir)) {
        fs.mkdirSync(processedDir, { recursive: true });
      }

      const filePath = path.join(processedDir, `${doc.id}.json`);
      await fs.promises.writeFile(filePath, JSON.stringify(doc, null, 2), 'utf-8');
      
      console.log(`Saved processed document: ${filePath}`);
    } catch (error) {
      console.error('Error saving processed document:', error);
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