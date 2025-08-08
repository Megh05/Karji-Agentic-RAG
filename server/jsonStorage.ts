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
  type UploadedFile,
  type InsertUploadedFile
} from "@shared/schema";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import type { IStorage } from "./storage_interface.js";

export class JSONStorage implements IStorage {
  private dataDir: string;
  private usersFile: string;
  private documentsFile: string;
  private productsFile: string;
  private offersFile: string;
  private apiConfigFile: string;
  private merchantFeedsFile: string;
  private uploadedFilesFile: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.usersFile = path.join(this.dataDir, 'users.json');
    this.documentsFile = path.join(this.dataDir, 'documents.json');
    this.productsFile = path.join(this.dataDir, 'products.json');
    this.offersFile = path.join(this.dataDir, 'offers.json');
    this.apiConfigFile = path.join(this.dataDir, 'api-config.json');
    this.merchantFeedsFile = path.join(this.dataDir, 'merchant-feeds.json');
    this.uploadedFilesFile = path.join(this.dataDir, 'uploaded-files.json');
    
    this.ensureDataDirectory();
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      console.log('Created data directory:', this.dataDir);
    }
  }

  private async readJSONFile<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
      if (!fs.existsSync(filePath)) {
        await this.writeJSONFile(filePath, defaultValue);
        return defaultValue;
      }
      const data = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch (error) {
      console.error(`Error reading JSON file ${filePath}:`, error);
      return defaultValue;
    }
  }

  private async writeJSONFile<T>(filePath: string, data: T): Promise<void> {
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Error writing JSON file ${filePath}:`, error);
      throw error;
    }
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const users = await this.readJSONFile<Record<string, User>>(this.usersFile, {});
    return users[id];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const users = await this.readJSONFile<Record<string, User>>(this.usersFile, {});
    return Object.values(users).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const users = await this.readJSONFile<Record<string, User>>(this.usersFile, {});
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    users[id] = user;
    await this.writeJSONFile(this.usersFile, users);
    return user;
  }

  // Document operations
  async getDocuments(): Promise<Document[]> {
    const documents = await this.readJSONFile<Record<string, Document>>(this.documentsFile, {});
    return Object.values(documents);
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const documents = await this.readJSONFile<Record<string, Document>>(this.documentsFile, {});
    const id = randomUUID();
    const document: Document = { 
      ...insertDocument, 
      id, 
      uploadedAt: new Date() 
    };
    documents[id] = document;
    await this.writeJSONFile(this.documentsFile, documents);
    return document;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const documents = await this.readJSONFile<Record<string, Document>>(this.documentsFile, {});
    if (!documents[id]) return false;
    delete documents[id];
    await this.writeJSONFile(this.documentsFile, documents);
    return true;
  }

  // Product operations
  async getProducts(): Promise<Product[]> {
    const products = await this.readJSONFile<Record<string, Product>>(this.productsFile, {});
    return Object.values(products);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const products = await this.readJSONFile<Record<string, Product>>(this.productsFile, {});
    return products[id];
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const products = await this.readJSONFile<Record<string, Product>>(this.productsFile, {});
    const product: Product = insertProduct;
    products[product.id] = product;
    await this.writeJSONFile(this.productsFile, products);
    return product;
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined> {
    const products = await this.readJSONFile<Record<string, Product>>(this.productsFile, {});
    if (!products[id]) return undefined;
    
    const updated = { ...products[id], ...updates };
    products[id] = updated;
    await this.writeJSONFile(this.productsFile, products);
    return updated;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const products = await this.readJSONFile<Record<string, Product>>(this.productsFile, {});
    if (!products[id]) return false;
    delete products[id];
    await this.writeJSONFile(this.productsFile, products);
    return true;
  }

  async clearProducts(): Promise<boolean> {
    await this.writeJSONFile(this.productsFile, {});
    return true;
  }

  async searchProducts(query: string): Promise<Product[]> {
    const products = await this.readJSONFile<Record<string, Product>>(this.productsFile, {});
    const queryLower = query.toLowerCase();
    return Object.values(products).filter(product => 
      product.title.toLowerCase().includes(queryLower) ||
      product.description?.toLowerCase().includes(queryLower) ||
      product.brand?.toLowerCase().includes(queryLower)
    );
  }

  // Offer operations
  async getOffers(): Promise<Offer[]> {
    const offers = await this.readJSONFile<Record<string, Offer>>(this.offersFile, {});
    return Object.values(offers);
  }

  async createOffer(insertOffer: InsertOffer): Promise<Offer> {
    const offers = await this.readJSONFile<Record<string, Offer>>(this.offersFile, {});
    const id = randomUUID();
    const offer: Offer = { 
      ...insertOffer, 
      id, 
      createdAt: new Date() 
    };
    offers[id] = offer;
    await this.writeJSONFile(this.offersFile, offers);
    return offer;
  }

  async deleteOffer(id: string): Promise<boolean> {
    const offers = await this.readJSONFile<Record<string, Offer>>(this.offersFile, {});
    if (!offers[id]) return false;
    delete offers[id];
    await this.writeJSONFile(this.offersFile, offers);
    return true;
  }

  async clearOffers(): Promise<boolean> {
    await this.writeJSONFile(this.offersFile, {});
    return true;
  }

  // API Config operations
  async getApiConfig(): Promise<ApiConfig | undefined> {
    const configs = await this.readJSONFile<Record<string, ApiConfig>>(this.apiConfigFile, {});
    return Object.values(configs)[0]; // Return first config
  }

  async upsertApiConfig(config: InsertApiConfig): Promise<ApiConfig> {
    const configs = await this.readJSONFile<Record<string, ApiConfig>>(this.apiConfigFile, {});
    const existing = Object.values(configs)[0];
    
    let apiConfig: ApiConfig;
    if (existing) {
      apiConfig = { ...existing, ...config };
      configs[existing.id] = apiConfig;
    } else {
      const id = randomUUID();
      apiConfig = { ...config, id };
      configs[id] = apiConfig;
    }
    
    await this.writeJSONFile(this.apiConfigFile, configs);
    return apiConfig;
  }

  // Merchant Feed operations
  async getMerchantFeeds(): Promise<MerchantFeed[]> {
    const feeds = await this.readJSONFile<Record<string, MerchantFeed>>(this.merchantFeedsFile, {});
    return Object.values(feeds);
  }

  async createMerchantFeed(insertFeed: InsertMerchantFeed): Promise<MerchantFeed> {
    const feeds = await this.readJSONFile<Record<string, MerchantFeed>>(this.merchantFeedsFile, {});
    const id = randomUUID();
    const feed: MerchantFeed = { 
      ...insertFeed, 
      id, 
      lastSynced: null,
      status: "pending"
    };
    feeds[id] = feed;
    await this.writeJSONFile(this.merchantFeedsFile, feeds);
    return feed;
  }

  async updateMerchantFeed(id: string, updates: Partial<MerchantFeed>): Promise<MerchantFeed | undefined> {
    const feeds = await this.readJSONFile<Record<string, MerchantFeed>>(this.merchantFeedsFile, {});
    if (!feeds[id]) return undefined;
    
    const updated = { ...feeds[id], ...updates };
    feeds[id] = updated;
    await this.writeJSONFile(this.merchantFeedsFile, feeds);
    return updated;
  }

  async deleteMerchantFeed(id: string): Promise<boolean> {
    const feeds = await this.readJSONFile<Record<string, MerchantFeed>>(this.merchantFeedsFile, {});
    if (!feeds[id]) return false;
    delete feeds[id];
    await this.writeJSONFile(this.merchantFeedsFile, feeds);
    return true;
  }

  // Uploaded File operations
  async getUploadedFiles(sourceType?: string): Promise<UploadedFile[]> {
    const files = await this.readJSONFile<Record<string, UploadedFile>>(this.uploadedFilesFile, {});
    const allFiles = Object.values(files);
    return sourceType ? allFiles.filter(file => file.sourceType === sourceType) : allFiles;
  }

  async createUploadedFile(insertFile: InsertUploadedFile): Promise<UploadedFile> {
    const files = await this.readJSONFile<Record<string, UploadedFile>>(this.uploadedFilesFile, {});
    const id = randomUUID();
    const file: UploadedFile = { 
      ...insertFile, 
      id, 
      uploadedAt: new Date(),
      processed: false
    };
    files[id] = file;
    await this.writeJSONFile(this.uploadedFilesFile, files);
    return file;
  }

  async updateUploadedFile(id: string, updates: Partial<UploadedFile>): Promise<UploadedFile | undefined> {
    const files = await this.readJSONFile<Record<string, UploadedFile>>(this.uploadedFilesFile, {});
    if (!files[id]) return undefined;
    
    const updated = { ...files[id], ...updates };
    files[id] = updated;
    await this.writeJSONFile(this.uploadedFilesFile, files);
    return updated;
  }

  async deleteUploadedFile(id: string): Promise<boolean> {
    const files = await this.readJSONFile<Record<string, UploadedFile>>(this.uploadedFilesFile, {});
    if (!files[id]) return false;
    delete files[id];
    await this.writeJSONFile(this.uploadedFilesFile, files);
    return true;
  }
}