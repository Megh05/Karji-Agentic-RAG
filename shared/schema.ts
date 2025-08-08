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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Offer = typeof offers.$inferSelect;
export type InsertOffer = z.infer<typeof insertOfferSchema>;
export type ApiConfig = typeof apiConfig.$inferSelect;
export type InsertApiConfig = z.infer<typeof insertApiConfigSchema>;
export type MerchantFeed = typeof merchantFeeds.$inferSelect;
export type InsertMerchantFeed = z.infer<typeof insertMerchantFeedSchema>;
