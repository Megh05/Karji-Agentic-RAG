import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull(),
  size: text("size").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  price: text("price"),
  originalPrice: text("original_price"),
  discountPrice: text("discount_price"),
  availability: text("availability"),
  imageLink: text("image_link"),
  link: text("link"),
  brand: text("brand"),
  condition: text("condition"),
  additionalFields: jsonb("additional_fields"),
});

export const offers = pgTable("offers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: text("product_id").notNull(),
  discountPrice: text("discount_price").notNull(),
  offerDesc: text("offer_desc").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const apiConfig = pgTable("api_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  openrouterKey: text("openrouter_key"),
  selectedModel: text("selected_model"),
  temperature: real("temperature").default(0.7),
  maxTokens: real("max_tokens").default(500),
});

export const merchantFeeds = pgTable("merchant_feeds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  lastSynced: timestamp("last_synced"),
  autoSync: boolean("auto_sync").default(true),
  status: text("status").default("pending"),
});

// Vector embeddings are now stored in ChromaDB instead of PostgreSQL
// This provides better performance and proper vector similarity search

export const uploadedFiles = pgTable("uploaded_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  originalName: text("original_name").notNull(),
  fileName: text("file_name").notNull(), // Stored file name
  filePath: text("file_path").notNull(), // Full path to stored file
  mimeType: text("mime_type").notNull(),
  size: text("size").notNull(),
  sourceType: text("source_type").notNull(), // 'document', 'merchant_feed', 'offer'
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  processed: boolean("processed").default(false),
});

export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull().unique(),
  // Theme Settings
  theme: text("theme").default("system"), // "light", "dark", "system"
  accentColor: text("accent_color").default("blue"), // "blue", "amber", "emerald", etc.
  // Chat Behavior
  chatStyle: text("chat_style").default("balanced"), // "concise", "detailed", "balanced"
  showProductImages: boolean("show_product_images").default(true),
  showPricing: boolean("show_pricing").default(true),
  autoSuggestions: boolean("auto_suggestions").default(true),
  // Communication Preferences
  communicationTone: text("communication_tone").default("friendly"), // "professional", "casual", "friendly"
  language: text("language").default("en"), // "en", "ar", "fr", etc.
  // Personalization
  rememberPreferences: boolean("remember_preferences").default(true),
  shareData: boolean("share_data").default(true),
  // Notifications
  soundEnabled: boolean("sound_enabled").default(true),
  notifications: boolean("notifications").default(true),
  // Display Settings
  compactMode: boolean("compact_mode").default(false),
  animationsEnabled: boolean("animations_enabled").default(true),
  // Privacy Settings
  anonymousMode: boolean("anonymous_mode").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
});

export const insertProductSchema = createInsertSchema(products);

export const insertOfferSchema = createInsertSchema(offers).omit({
  id: true,
  createdAt: true,
});

export const insertApiConfigSchema = createInsertSchema(apiConfig).omit({
  id: true,
});

export const insertMerchantFeedSchema = createInsertSchema(merchantFeeds).omit({
  id: true,
  lastSynced: true,
});

// Vector embedding schemas removed - using ChromaDB for vector storage

export const insertUploadedFileSchema = createInsertSchema(uploadedFiles).omit({
  id: true,
  uploadedAt: true,
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Offer = typeof offers.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type InsertOffer = z.infer<typeof insertOfferSchema>;
export type ApiConfig = typeof apiConfig.$inferSelect;
export type InsertApiConfig = z.infer<typeof insertApiConfigSchema>;
export type MerchantFeed = typeof merchantFeeds.$inferSelect;
export type InsertMerchantFeed = z.infer<typeof insertMerchantFeedSchema>;
// Vector embedding types removed - using ChromaDB for vector storage
export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type InsertUploadedFile = z.infer<typeof insertUploadedFileSchema>;
