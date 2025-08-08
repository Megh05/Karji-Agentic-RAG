import { 
  type User, 
  type InsertUser, 
  type Document, 
  type InsertDocument,
  type Product,
  type InsertProduct,
  type Offer,
  type InsertOffer,
  type ApiConfig,
  type InsertApiConfig,
  type MerchantFeed,
  type InsertMerchantFeed,
  type VectorEmbedding,
  type InsertVectorEmbedding,
  type UploadedFile,
  type InsertUploadedFile
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Document operations
  getDocuments(): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  deleteDocument(id: string): Promise<boolean>;

  // Product operations
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  clearProducts(): Promise<boolean>;
  searchProducts(query: string): Promise<Product[]>;

  // Offer operations
  getOffers(): Promise<Offer[]>;
  createOffer(offer: InsertOffer): Promise<Offer>;
  deleteOffer(id: string): Promise<boolean>;
  clearOffers(): Promise<boolean>;

  // API Config operations
  getApiConfig(): Promise<ApiConfig | undefined>;
  upsertApiConfig(config: InsertApiConfig): Promise<ApiConfig>;

  // Merchant Feed operations
  getMerchantFeeds(): Promise<MerchantFeed[]>;
  createMerchantFeed(feed: InsertMerchantFeed): Promise<MerchantFeed>;
  updateMerchantFeed(id: string, updates: Partial<MerchantFeed>): Promise<MerchantFeed | undefined>;
  deleteMerchantFeed(id: string): Promise<boolean>;

  // Vector Embedding operations
  getEmbeddings(sourceId?: string, sourceType?: string): Promise<VectorEmbedding[]>;
  createEmbedding(embedding: InsertVectorEmbedding): Promise<VectorEmbedding>;
  deleteEmbeddings(sourceId: string, sourceType?: string): Promise<boolean>;
  clearAllEmbeddings(): Promise<boolean>;

  // Uploaded File operations
  getUploadedFiles(sourceType?: string): Promise<UploadedFile[]>;
  createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile>;
  updateUploadedFile(id: string, updates: Partial<UploadedFile>): Promise<UploadedFile | undefined>;
  deleteUploadedFile(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private documents: Map<string, Document>;
  private products: Map<string, Product>;
  private offers: Map<string, Offer>;
  private apiConfig: ApiConfig | undefined;
  private merchantFeeds: Map<string, MerchantFeed>;

  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.products = new Map();
    this.offers = new Map();
    this.merchantFeeds = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values());
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const document: Document = { 
      ...insertDocument, 
      id, 
      uploadedAt: new Date() 
    };
    this.documents.set(id, document);
    return document;
  }

  async deleteDocument(id: string): Promise<boolean> {
    return this.documents.delete(id);
  }

  async getProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const product: Product = { 
      ...insertProduct,
      brand: insertProduct.brand || null,
      link: insertProduct.link || null,
      description: insertProduct.description || null,
      price: insertProduct.price || null,
      originalPrice: insertProduct.originalPrice || null,
      discountPrice: insertProduct.discountPrice || null,
      availability: insertProduct.availability || null,
      imageLink: insertProduct.imageLink || null,
      condition: insertProduct.condition || null,
      additionalFields: insertProduct.additionalFields || null
    };
    this.products.set(product.id, product);
    return product;
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined> {
    const existing = this.products.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.products.set(id, updated);
    return updated;
  }

  async deleteProduct(id: string): Promise<boolean> {
    return this.products.delete(id);
  }

  async clearProducts(): Promise<boolean> {
    this.products.clear();
    return true;
  }

  async searchProducts(query: string): Promise<Product[]> {
    const queryLower = query.toLowerCase();
    return Array.from(this.products.values()).filter(product => 
      product.title.toLowerCase().includes(queryLower) ||
      product.description?.toLowerCase().includes(queryLower) ||
      product.brand?.toLowerCase().includes(queryLower)
    );
  }

  async getOffers(): Promise<Offer[]> {
    return Array.from(this.offers.values());
  }

  async createOffer(insertOffer: InsertOffer): Promise<Offer> {
    const id = randomUUID();
    const offer: Offer = { 
      ...insertOffer, 
      id, 
      createdAt: new Date() 
    };
    this.offers.set(id, offer);
    return offer;
  }

  async deleteOffer(id: string): Promise<boolean> {
    return this.offers.delete(id);
  }

  async clearOffers(): Promise<boolean> {
    this.offers.clear();
    return true;
  }

  async getApiConfig(): Promise<ApiConfig | undefined> {
    return this.apiConfig;
  }

  async upsertApiConfig(config: InsertApiConfig): Promise<ApiConfig> {
    const id = this.apiConfig?.id || randomUUID();
    this.apiConfig = { 
      id,
      openrouterKey: config.openrouterKey || null,
      selectedModel: config.selectedModel || null,
      temperature: config.temperature || null,
      maxTokens: config.maxTokens || null
    };
    return this.apiConfig;
  }

  async getMerchantFeeds(): Promise<MerchantFeed[]> {
    return Array.from(this.merchantFeeds.values());
  }

  async createMerchantFeed(insertFeed: InsertMerchantFeed): Promise<MerchantFeed> {
    const id = randomUUID();
    const feed: MerchantFeed = { 
      ...insertFeed, 
      id,
      lastSynced: null,
      status: insertFeed.status || null,
      autoSync: insertFeed.autoSync || null
    };
    this.merchantFeeds.set(id, feed);
    return feed;
  }

  async updateMerchantFeed(id: string, updates: Partial<MerchantFeed>): Promise<MerchantFeed | undefined> {
    const existing = this.merchantFeeds.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.merchantFeeds.set(id, updated);
    return updated;
  }

  async deleteMerchantFeed(id: string): Promise<boolean> {
    return this.merchantFeeds.delete(id);
  }
}

// Import database storage
import { DatabaseStorage } from './services/databaseStorage.js';

// Use database storage instead of memory storage
export const storage = new DatabaseStorage();
