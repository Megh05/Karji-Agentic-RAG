export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  products?: any[];
  intent?: {
    searchTerms: string[];
    priceFilter: { min?: number; max?: number } | null;
    categoryHints: string[];
    brandPreferences: string[];
    qualityLevel: 'budget' | 'mid-range' | 'luxury' | null;
  };
}

export interface UserSession {
  sessionId: string;
  messages: ConversationMessage[];
  preferences: {
    preferredCategories: string[];
    preferredBrands: string[];
    budgetRange: { min?: number; max?: number } | null;
    qualityLevel: 'budget' | 'mid-range' | 'luxury' | null;
  };
  lastActivity: Date;
}

class ConversationService {
  private static instance: ConversationService;
  private sessions: Map<string, UserSession> = new Map();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  static getInstance(): ConversationService {
    if (!ConversationService.instance) {
      ConversationService.instance = new ConversationService();
    }
    return ConversationService.instance;
  }

  private constructor() {
    // Clean up expired sessions every 5 minutes
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [sessionId, session] of this.sessions) {
      if (now.getTime() - session.lastActivity.getTime() > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
        console.log(`Cleaned up expired session: ${sessionId}`);
      }
    }
  }

  public getOrCreateSession(sessionId?: string): string {
    // If sessionId is provided, try to use it or create it
    if (sessionId) {
      if (!this.sessions.has(sessionId)) {
        this.sessions.set(sessionId, {
          sessionId,
          messages: [],
          preferences: {
            preferredCategories: [],
            preferredBrands: [],
            budgetRange: null,
            qualityLevel: null
          },
          lastActivity: new Date()
        });
        console.log(`Created new conversation session with provided ID: ${sessionId}`);
        return sessionId;
      } else {
        // Update last activity for existing session
        const session = this.sessions.get(sessionId)!;
        session.lastActivity = new Date();
        return sessionId;
      }
    }

    // If no sessionId provided, generate a new one
    const newSessionId = this.generateSessionId();
    this.sessions.set(newSessionId, {
      sessionId: newSessionId,
      messages: [],
      preferences: {
        preferredCategories: [],
        preferredBrands: [],
        budgetRange: null,
        qualityLevel: null
      },
      lastActivity: new Date()
    });
    console.log(`Created new conversation session: ${newSessionId}`);
    return newSessionId;
  }

  public addMessage(
    sessionId: string, 
    role: 'user' | 'assistant', 
    content: string, 
    products?: any[], 
    intent?: any
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const message: ConversationMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role,
      content,
      timestamp: new Date(),
      products,
      intent
    };

    session.messages.push(message);
    session.lastActivity = new Date();

    // Update user preferences based on message intent
    if (role === 'user' && intent) {
      this.updateUserPreferences(sessionId, intent);
    }

    console.log(`Added ${role} message to session ${sessionId}`);
  }

  private updateUserPreferences(sessionId: string, intent: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const prefs = session.preferences;

    // Update preferred categories
    if (intent.categoryHints && intent.categoryHints.length > 0) {
      intent.categoryHints.forEach((category: string) => {
        if (!prefs.preferredCategories.includes(category)) {
          prefs.preferredCategories.push(category);
        }
      });
    }

    // Update preferred brands
    if (intent.brandPreferences && intent.brandPreferences.length > 0) {
      intent.brandPreferences.forEach((brand: string) => {
        if (!prefs.preferredBrands.includes(brand)) {
          prefs.preferredBrands.push(brand);
        }
      });
    }

    // Update budget range (keep the most restrictive/recent)
    if (intent.priceFilter) {
      prefs.budgetRange = intent.priceFilter;
    }

    // Update quality level (keep the most recent)
    if (intent.qualityLevel) {
      prefs.qualityLevel = intent.qualityLevel;
    }

    console.log(`Updated preferences for session ${sessionId}:`, prefs);
  }

  public getConversationHistory(sessionId: string, limit?: number): ConversationMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const messages = session.messages;
    return limit ? messages.slice(-limit) : messages;
  }

  public getContextualPrompt(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) return '';

    const prefs = session.preferences;
    const recentMessages = session.messages.slice(-6); // Last 3 exchanges

    let context = '';

    // Add user preferences context
    if (prefs.preferredCategories.length > 0) {
      context += `User has shown interest in: ${prefs.preferredCategories.join(', ')}. `;
    }

    if (prefs.preferredBrands.length > 0) {
      context += `User prefers brands: ${prefs.preferredBrands.join(', ')}. `;
    }

    if (prefs.budgetRange) {
      const { min, max } = prefs.budgetRange;
      if (min && max) {
        context += `User's budget range: ${min}-${max} AED. `;
      } else if (max) {
        context += `User's budget limit: up to ${max} AED. `;
      } else if (min) {
        context += `User's budget: from ${min} AED and above. `;
      }
    }

    if (prefs.qualityLevel) {
      context += `User prefers ${prefs.qualityLevel} quality items. `;
    }

    // Add recent conversation context
    if (recentMessages.length > 0) {
      context += '\n\nRecent conversation:\n';
      recentMessages.forEach(msg => {
        context += `${msg.role}: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}\n`;
      });
    }

    return context;
  }

  public getUserPreferences(sessionId: string): UserSession['preferences'] | null {
    const session = this.sessions.get(sessionId);
    return session ? session.preferences : null;
  }

  public clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    console.log(`Cleared session: ${sessionId}`);
  }

  public getSessionStats(): { totalSessions: number; activeMessages: number } {
    let totalMessages = 0;
    for (const session of this.sessions.values()) {
      totalMessages += session.messages.length;
    }

    return {
      totalSessions: this.sessions.size,
      activeMessages: totalMessages
    };
  }
}

export const conversationService = ConversationService.getInstance();