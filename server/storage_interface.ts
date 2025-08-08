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

  // Uploaded File operations
  getUploadedFiles(sourceType?: string): Promise<UploadedFile[]>;
  createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile>;
  updateUploadedFile(id: string, updates: Partial<UploadedFile>): Promise<UploadedFile | undefined>;
  deleteUploadedFile(id: string): Promise<boolean>;
}