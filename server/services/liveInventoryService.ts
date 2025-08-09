import type { Product } from '@shared/schema';

export interface InventoryStatus {
  productId: string;
  stock: number;
  lastUpdated: Date;
  priceChanges: { price: string; timestamp: Date }[];
  demandLevel: 'low' | 'medium' | 'high';
  trending: boolean;
}

export interface DynamicPricing {
  basePrice: number;
  currentPrice: number;
  discountPercentage: number;
  userSpecificDiscount?: number;
  urgencyMultiplier: number;
  demandMultiplier: number;
}

export interface SocialProofData {
  recentViews: number;
  recentPurchases: number;
  popularityScore: number;
  customerRatings: { average: number; count: number };
  socialSignals: string[];
}

class LiveInventoryService {
  private static instance: LiveInventoryService;
  private inventoryCache: Map<string, InventoryStatus> = new Map();
  private socialProofCache: Map<string, SocialProofData> = new Map();

  static getInstance(): LiveInventoryService {
    if (!LiveInventoryService.instance) {
      LiveInventoryService.instance = new LiveInventoryService();
    }
    return LiveInventoryService.instance;
  }

  public async getInventoryStatus(productId: string): Promise<InventoryStatus> {
    // Check cache first
    if (this.inventoryCache.has(productId)) {
      const cached = this.inventoryCache.get(productId)!;
      // Return cached if less than 5 minutes old
      if (Date.now() - cached.lastUpdated.getTime() < 5 * 60 * 1000) {
        return cached;
      }
    }

    // Simulate real-time inventory check (in production, this would connect to inventory system)
    const status: InventoryStatus = {
      productId,
      stock: this.generateRealisticStock(),
      lastUpdated: new Date(),
      priceChanges: [],
      demandLevel: this.calculateDemandLevel(productId),
      trending: Math.random() > 0.8 // 20% chance of trending
    };

    this.inventoryCache.set(productId, status);
    return status;
  }

  public async getDynamicPricing(product: Product, userProfile?: any): Promise<DynamicPricing> {
    const basePrice = parseFloat(product.price?.replace(/[^\d.]/g, '') || '0');
    let currentPrice = basePrice;
    let discountPercentage = 0;

    // Apply discounts from product data
    if (product.discountPrice) {
      const discountPrice = parseFloat(product.discountPrice.replace(/[^\d.]/g, ''));
      discountPercentage = ((basePrice - discountPrice) / basePrice) * 100;
      currentPrice = discountPrice;
    }

    // Apply user-specific discounts based on profile
    let userSpecificDiscount = 0;
    if (userProfile) {
      userSpecificDiscount = this.calculateUserDiscount(userProfile);
      if (userSpecificDiscount > 0) {
        currentPrice = currentPrice * (1 - userSpecificDiscount / 100);
        discountPercentage += userSpecificDiscount;
      }
    }

    // Apply urgency and demand multipliers
    const inventory = await this.getInventoryStatus(product.id);
    const urgencyMultiplier = this.calculateUrgencyMultiplier(inventory);
    const demandMultiplier = this.calculateDemandMultiplier(inventory);

    return {
      basePrice,
      currentPrice: Math.round(currentPrice * 100) / 100,
      discountPercentage: Math.round(discountPercentage),
      userSpecificDiscount,
      urgencyMultiplier,
      demandMultiplier
    };
  }

  public async getSocialProof(productId: string): Promise<SocialProofData> {
    // Check cache first
    if (this.socialProofCache.has(productId)) {
      const cached = this.socialProofCache.get(productId)!;
      return cached;
    }

    // Generate realistic social proof data
    const socialProof: SocialProofData = {
      recentViews: Math.floor(Math.random() * 200) + 20,
      recentPurchases: Math.floor(Math.random() * 50) + 5,
      popularityScore: Math.random(),
      customerRatings: {
        average: 3.5 + Math.random() * 1.5, // 3.5 to 5.0
        count: Math.floor(Math.random() * 500) + 50
      },
      socialSignals: this.generateSocialSignals()
    };

    this.socialProofCache.set(productId, socialProof);
    return socialProof;
  }

  public generateUrgencyIndicators(product: Product, inventory: InventoryStatus): string[] {
    const indicators: string[] = [];

    // Stock-based urgency
    if (inventory.stock <= 5 && inventory.stock > 0) {
      indicators.push(`Only ${inventory.stock} left in stock`);
    } else if (inventory.stock === 0) {
      indicators.push('Out of stock - limited availability');
    }

    // Demand-based urgency
    if (inventory.demandLevel === 'high') {
      indicators.push('High demand item');
    }

    // Trending indicators
    if (inventory.trending) {
      indicators.push('Trending now');
    }

    // Time-based urgency (simulate limited time offers)
    if (Math.random() > 0.7) {
      const hours = Math.floor(Math.random() * 24) + 1;
      indicators.push(`Sale ends in ${hours} hours`);
    }

    // Seasonal urgency
    const month = new Date().getMonth();
    if ([10, 11, 0].includes(month)) { // Nov, Dec, Jan - holiday season
      indicators.push('Holiday special pricing');
    }

    return indicators;
  }

  public generateSocialProofMessages(socialProof: SocialProofData): string[] {
    const messages: string[] = [];

    // Recent activity
    if (socialProof.recentViews > 50) {
      messages.push(`${socialProof.recentViews}+ people viewed this today`);
    }

    if (socialProof.recentPurchases > 10) {
      messages.push(`${socialProof.recentPurchases} people bought this recently`);
    }

    // Ratings
    if (socialProof.customerRatings.average > 4.0) {
      messages.push(`⭐ ${socialProof.customerRatings.average.toFixed(1)} (${socialProof.customerRatings.count} reviews)`);
    }

    // Popularity
    if (socialProof.popularityScore > 0.8) {
      messages.push('Best seller in category');
    } else if (socialProof.popularityScore > 0.6) {
      messages.push('Popular choice');
    }

    // Custom signals
    messages.push(...socialProof.socialSignals);

    return messages.slice(0, 3); // Limit to 3 messages
  }

  private generateRealisticStock(): number {
    const random = Math.random();
    if (random < 0.1) return 0; // 10% out of stock
    if (random < 0.2) return Math.floor(Math.random() * 5) + 1; // 10% low stock (1-5)
    if (random < 0.7) return Math.floor(Math.random() * 50) + 10; // 50% medium stock (10-60)
    return Math.floor(Math.random() * 200) + 50; // 30% high stock (50-250)
  }

  private calculateDemandLevel(productId: string): 'low' | 'medium' | 'high' {
    // Simple hash-based demand simulation
    const hash = Array.from(productId).reduce((a, b) => a + b.charCodeAt(0), 0);
    const demandScore = hash % 100;
    
    if (demandScore > 70) return 'high';
    if (demandScore > 40) return 'medium';
    return 'low';
  }

  private calculateUserDiscount(userProfile: any): number {
    let discount = 0;

    // Loyalty discount based on trust level
    if (userProfile.emotionalProfile?.trustLevel > 0.8) {
      discount += 5; // 5% for highly trusted users
    }

    // First-time buyer discount
    if (userProfile.behaviorPatterns?.purchaseHistory?.length === 0) {
      discount += 10; // 10% for first-time buyers
    }

    // Volume discount for frequent browsers
    if (userProfile.behaviorPatterns?.messageFrequency > 20) {
      discount += 3; // 3% for engaged users
    }

    // Urgency-based discount (encourage quick decisions)
    if (userProfile.emotionalProfile?.urgencyLevel > 0.7) {
      discount += 5; // 5% for urgent buyers
    }

    return Math.min(discount, 20); // Cap at 20% total discount
  }

  private calculateUrgencyMultiplier(inventory: InventoryStatus): number {
    if (inventory.stock === 0) return 1.5;
    if (inventory.stock <= 5) return 1.3;
    if (inventory.demandLevel === 'high') return 1.2;
    return 1.0;
  }

  private calculateDemandMultiplier(inventory: InventoryStatus): number {
    switch (inventory.demandLevel) {
      case 'high': return 1.2;
      case 'medium': return 1.1;
      default: return 1.0;
    }
  }

  private generateSocialSignals(): string[] {
    const signals = [
      'Recommended by beauty experts',
      'Celebrity favorite',
      'Award-winning product',
      'Customers love this',
      'Fast shipping available',
      'Satisfaction guaranteed',
      'Limited edition',
      'New arrival',
      'Staff pick',
      'Customer favorite'
    ];

    // Return 1-2 random signals
    const count = Math.floor(Math.random() * 2) + 1;
    const shuffled = signals.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  // Seasonal relevance system
  public getSeasonalRelevance(product: Product): { 
    isRelevant: boolean; 
    reason: string; 
    boost: number 
  } {
    const now = new Date();
    const month = now.getMonth();
    const productTitle = product.title?.toLowerCase() || '';

    // Holiday season (Nov-Jan)
    if ([10, 11, 0].includes(month)) {
      if (productTitle.includes('gift') || productTitle.includes('perfume') || productTitle.includes('jewelry')) {
        return { isRelevant: true, reason: 'Perfect for holiday gifting', boost: 1.3 };
      }
    }

    // Summer season (Jun-Aug)
    if ([5, 6, 7].includes(month)) {
      if (productTitle.includes('fresh') || productTitle.includes('citrus') || productTitle.includes('light')) {
        return { isRelevant: true, reason: 'Perfect for summer', boost: 1.2 };
      }
    }

    // Winter season (Dec-Feb)
    if ([11, 0, 1].includes(month)) {
      if (productTitle.includes('warm') || productTitle.includes('rich') || productTitle.includes('intense')) {
        return { isRelevant: true, reason: 'Ideal for winter', boost: 1.2 };
      }
    }

    // Valentine's Day (February)
    if (month === 1) {
      if (productTitle.includes('romantic') || productTitle.includes('love') || productTitle.includes('rose')) {
        return { isRelevant: true, reason: 'Perfect for Valentine\'s Day', boost: 1.4 };
      }
    }

    return { isRelevant: false, reason: '', boost: 1.0 };
  }

  // Smart bundling suggestions
  public async getSmartBundles(product: Product, userProfile?: any): Promise<{
    bundles: { products: Product[]; discount: number; reason: string }[];
    alternatives: Product[];
  }> {
    // This would integrate with the product database in a real implementation
    return {
      bundles: [
        {
          products: [product], // Placeholder - would include complementary products
          discount: 15,
          reason: 'Frequently bought together'
        }
      ],
      alternatives: [] // Would include similar products at different price points
    };
  }
}

export const liveInventoryService = LiveInventoryService.getInstance();