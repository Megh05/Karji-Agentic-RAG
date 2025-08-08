import { 
  users, documents, products, offers, apiConfig, merchantFeeds, uploadedFiles,
  type User, type InsertUser, type Document, type InsertDocument,
  type Product, type InsertProduct, type Offer, type InsertOffer,
  type ApiConfig, type InsertApiConfig, type MerchantFeed, type InsertMerchantFeed,
  type UploadedFile, type InsertUploadedFile
} from "@shared/schema";
import { db } from "../db.js";
import { eq, and } from "drizzle-orm";
import { IStorage } from "../storage.js";

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Document operations
  async getDocuments(): Promise<Document[]> {
    return await db.select().from(documents);
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db.insert(documents).values(insertDocument).returning();
    return document;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id));
    return result.rowCount > 0;
  }

  // Product operations
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined> {
    const [updated] = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    return updated || undefined;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return result.rowCount > 0;
  }

  async clearProducts(): Promise<boolean> {
    await db.delete(products);
    return true;
  }

  async searchProducts(query: string): Promise<Product[]> {
    // Use PostgreSQL full-text search
    const allProducts = await this.getProducts();
    const queryLower = query.toLowerCase();
    return allProducts.filter(product => 
      product.title.toLowerCase().includes(queryLower) ||
      product.description?.toLowerCase().includes(queryLower) ||
      product.brand?.toLowerCase().includes(queryLower)
    );
  }

  // Offer operations
  async getOffers(): Promise<Offer[]> {
    return await db.select().from(offers);
  }

  async createOffer(insertOffer: InsertOffer): Promise<Offer> {
    const [offer] = await db.insert(offers).values(insertOffer).returning();
    return offer;
  }

  async deleteOffer(id: string): Promise<boolean> {
    const result = await db.delete(offers).where(eq(offers.id, id));
    return result.rowCount > 0;
  }

  async clearOffers(): Promise<boolean> {
    await db.delete(offers);
    return true;
  }

  // API Config operations
  async getApiConfig(): Promise<ApiConfig | undefined> {
    const [config] = await db.select().from(apiConfig).limit(1);
    return config || undefined;
  }

  async upsertApiConfig(config: InsertApiConfig): Promise<ApiConfig> {
    const existing = await this.getApiConfig();
    
    if (existing) {
      const [updated] = await db.update(apiConfig)
        .set(config)
        .where(eq(apiConfig.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(apiConfig).values(config).returning();
      return created;
    }
  }

  // Merchant Feed operations
  async getMerchantFeeds(): Promise<MerchantFeed[]> {
    return await db.select().from(merchantFeeds);
  }

  async createMerchantFeed(insertFeed: InsertMerchantFeed): Promise<MerchantFeed> {
    const [feed] = await db.insert(merchantFeeds).values(insertFeed).returning();
    return feed;
  }

  async updateMerchantFeed(id: string, updates: Partial<MerchantFeed>): Promise<MerchantFeed | undefined> {
    const [updated] = await db.update(merchantFeeds)
      .set(updates)
      .where(eq(merchantFeeds.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteMerchantFeed(id: string): Promise<boolean> {
    const result = await db.delete(merchantFeeds).where(eq(merchantFeeds.id, id));
    return result.rowCount > 0;
  }

  // Vector embeddings are now managed by ChromaDB service
  // Removed PostgreSQL embedding operations for better performance

  // Uploaded File operations
  async getUploadedFiles(sourceType?: string): Promise<UploadedFile[]> {
    if (sourceType) {
      return await db.select().from(uploadedFiles).where(eq(uploadedFiles.sourceType, sourceType));
    } else {
      return await db.select().from(uploadedFiles);
    }
  }

  async createUploadedFile(insertFile: InsertUploadedFile): Promise<UploadedFile> {
    const [file] = await db.insert(uploadedFiles).values(insertFile).returning();
    return file;
  }

  async updateUploadedFile(id: string, updates: Partial<UploadedFile>): Promise<UploadedFile | undefined> {
    const [updated] = await db.update(uploadedFiles)
      .set(updates)
      .where(eq(uploadedFiles.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteUploadedFile(id: string): Promise<boolean> {
    const result = await db.delete(uploadedFiles).where(eq(uploadedFiles.id, id));
    return result.rowCount > 0;
  }
}