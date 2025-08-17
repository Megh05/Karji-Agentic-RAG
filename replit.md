# Overview

This is a full-stack e-commerce AI chatbot application for KarjiStore.com. It features an intelligent sales assistant that combines Retrieval-Augmented Generation (RAG) with product recommendations. The system includes a React-based chat interface and an admin dashboard for managing knowledge base content, product data, and AI configuration.

## Recent Changes (August 2025)
- ✅ **LUXURY UI/UX REDESIGN COMPLETE**: Complete transformation of the user interface with elegant luxury design aesthetic
- ✅ **NEW KARJISTORE CHATBOT**: Implemented sophisticated floating chatbot with luxury gradients, refined typography, and smooth animations
- ✅ **LUXURY COLOR SCHEME**: Updated entire color palette to luxury gold/amber theme with proper dark mode support
- ✅ **MAIN INTERFACE REDESIGN**: Updated chat interface, sidebar, and all components with luxury amber/gold gradient theme
- ✅ **PRESERVED FUNCTIONALITY**: Maintained all existing smart features including product recommendations, smart messaging, and RAG functionality
- ✅ **CUSTOM ANIMATIONS**: Added KarjiStore-specific animations including luxury bounce effects and pulse indicators
- ✅ **RESPONSIVE LUXURY DESIGN**: Ensured all components work beautifully on all screen sizes with luxury aesthetics
- ✅ **MERCHANT FEED PAGINATION**: Implemented comprehensive pagination system with search and filtering for product catalog management
- ✅ **DEMO OFFERS CREATED**: Added luxury fragrance, accessory, and gift set offers with realistic pricing and descriptions
- ✅ **API KEY INTEGRATION**: Successfully configured OpenRouter API key for proper chat functionality
- ✅ **CRITICAL FIX: Gender filtering system completely rebuilt** - Now properly filters men vs women products with strict exclusion logic
- ✅ **DEALS & DISCOUNT INTELLIGENCE**: Enhanced chatbot to properly detect and handle deal/discount conversations with smart product recommendations
- ✅ **ELEGANT COLOR SCHEME UPDATE**: Replaced golden/yellow theme with sophisticated navy-blue and cream palette for more soothing, elegant aesthetics
- ✅ **PROFESSIONAL MODERN REDESIGN (August 2025)**: Completely transformed to tech-savvy Professional Modern theme with Gainsboro (#DCDCDD), French Gray (#C5C3C6), Outer Space (#46494C), Payne's Gray (#4C5C68), and Blue Munsell (#1985A1) for sophisticated tech elegance across all components
- ✅ **IMPROVED SCORING ALGORITHM**: Fixed product search scoring to properly boost deal-related products and lower thresholds for deal queries
- ✅ **MAJOR INTELLIGENCE UPGRADE: Enhanced chat flow for new users** - Fixed system message truncation issues and over-eager product recommendations
- ✅ **SMART PRODUCT FILTERING: Implemented intelligent product recommendation logic** - Products now only show when users have specific preferences or explicitly request them
- ✅ **NEW USER ONBOARDING: Added comprehensive welcome experience** - Interactive category browsing, quick questions, and store highlights to educate new users
- ✅ **FIXED COMPARISON FEATURE: Built functional product comparison component** - Smart comparison tables with detailed product analysis and selection features
- ✅ **OPTIMIZED SYSTEM PROMPTS: Prevented truncation with smarter token management** - Reduced prompt size while maintaining all critical instructions
- ✅ **ENHANCED INTENT RECOGNITION: Refined support vs. browsing vs. comparison detection** - Better handling of general questions like "help me narrow down" and "compare options"
- ✅ Fixed conversation flow imperfections at purchase confirmation stage
- ✅ Enhanced gender-aware search scoring to properly prioritize gender-specific products with complete exclusion of wrong gender
- ✅ Implemented purchase confirmation detection to prevent unrelated product searches
- ✅ Updated intent recognition to handle "Yes, I want to buy this" properly
- ✅ Improved follow-up suggestions to be contextually appropriate for purchase flow
- ✅ Added purchase-specific system prompts to guide checkout assistance instead of product browsing
- ✅ Fixed product search algorithm to properly detect and boost women's/men/unisex product categories
- ✅ **CRITICAL FIX (August 2025): Eliminated system response truncation** - Responses no longer cut off mid-sentence, increased limit to 500 characters with intelligent sentence boundary detection
- ✅ **COMPREHENSIVE DISCOUNT SYSTEM IMPLEMENTED** - Products with offers now show strikethrough original pricing, discount badges, savings percentages, and offer details
- ✅ **INTELLIGENT ALTERNATIVE SUGGESTIONS** - When specific brands (like Tom Ford) aren't available in requested price ranges, system suggests alternatives with explanatory messaging
- ✅ **ENHANCED BRAND DETECTION** - Expanded brand recognition to include Tom Ford, luxury designers, and multi-word brand names with proper scoring priorities
- ✅ **DYNAMIC FOLLOW-UP QUESTIONS (August 2025)** - Completely rebuilt follow-up question system to generate contextual, response-related suggestions based on AI response content and user query analysis
- ✅ **ELIMINATED REDUNDANT PRODUCT DESCRIPTIONS** - AI responses no longer repeat product details when visual product cards are displayed, keeping text conversational and focused on customer guidance
- ✅ **CRITICAL FIX: COMPLETE GENDER FILTERING SYSTEM (August 2025)** - FULLY RESOLVED all cross-gender product contamination across ALL search paths (initial search + similar products). Enhanced family relationship detection ("for mom", "for dad", "for her", etc.) with comprehensive gender indicators. Men's searches now exclusively return men's products, women's searches return only women's products. Zero cross-gender leakage confirmed through comprehensive testing. System enforces strict gender boundaries in both initial product recommendations and similar product suggestions.
- ✅ **SUCCESSFUL MIGRATION TO REPLIT ENVIRONMENT (August 17, 2025)** - Successfully migrated entire project from Replit Agent to standard Replit environment with all functionality preserved. Installed missing dependencies (tsx), fixed workflow execution, and verified complete system operation.
- ✅ **UI ELEMENTS TEMPORARILY HIDDEN (August 17, 2025)** - Hidden smart follow-up questions, contextual suggestions, quick action buttons (Filter, Deals, etc.), and floating chat widget button while preserving all code for future use. Elements can be easily restored by removing 'hidden' CSS classes.
- ✅ **COMPLETE 3D CARDBOARD LUXURY DESIGN TRANSFORMATION (August 17, 2025)** - Implemented sophisticated 3D cardboard-style design system across entire interface with luxury gold/brown color palette, elevated shadows, layered depth effects, and premium textures. Enhanced all components including chat interface, message bubbles, product cards, buttons, inputs, settings modal, and navigation with responsive 3D cardboard aesthetics. Added custom animations (cardboard-float, cardboard-pulse), texture overlays, luxury text gradients, and comprehensive responsive design classes for elegant, elevated user experience.



# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Radix UI components with shadcn/ui design system
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL support
- **File Handling**: Multer for document uploads
- **Session Management**: Express sessions with PostgreSQL store
- **API Design**: RESTful APIs with structured error handling

## Data Storage Architecture
- **Primary Database**: JSON-based file storage system
- **Data Directory**: `/data/` with organized JSON files for each entity type
- **Storage Files**: 
  - `users.json` - User authentication data
  - `documents.json` - Knowledge base files metadata
  - `products.json` - E-commerce product catalog
  - `offers.json` - Promotional pricing and discounts
  - `api-config.json` - OpenRouter API settings
  - `merchant-feeds.json` - External product feed configurations
  - `uploaded-files.json` - File upload tracking and metadata
- **File Storage System**: Organized upload folders with automatic directory management
  - `/uploads/documents/` - PDF, Word, Excel, CSV files
  - `/uploads/merchant-feeds/` - XML feed data and processed product information
  - `/uploads/offers/` - Offer spreadsheets and processed data
  - `/uploads/embeddings/` - Vector embedding backups (ChromaDB fallback)
  - `/uploads/processed/` - Processed document chunks and extracted data (Langchain)
- **Vector Storage Strategy**: ChromaDB for vector embeddings with in-memory fallback when unavailable

## RAG Implementation with Langchain
- **Framework**: Langchain for comprehensive RAG pipeline
- **Primary Vector Storage**: ChromaDB with in-memory fallback when unavailable
- **Text Processing**: Langchain RecursiveCharacterTextSplitter for optimal document chunking
- **Embedding Model**: HuggingFace Transformers (all-MiniLM-L6-v2) for local embeddings
- **Vector Storage**: Dual approach with Langchain MemoryVectorStore and ChromaDB persistence
- **Document Processing**: Automated chunking and vectorization of all uploaded documents
- **Product Indexing**: Intelligent product content processing for e-commerce search
- **Context Retrieval**: Advanced similarity search combining documents and product data
- **Persistence Strategy**: All processed documents and chunks stored locally in `/uploads/processed/`
- **Data Persistence**: All scraped data, documents, and file metadata stored in JSON files

## Chat System Architecture
- **Message Flow**: User input → Session management → RAG context retrieval → Conversational context → LLM processing → Structured response
- **Product Recommendations**: Integrated product cards within chat responses with preference-based filtering
- **Conversational Memory**: Full session-based conversation history with user preference learning
- **Context Management**: Maintains conversation history, user preferences, and relevant product context across sessions
- **Session Management**: Automatic session creation, preference tracking, and cleanup with 30-minute timeout

## Admin Panel Features
- **API Configuration**: OpenRouter API key setup with live model fetching (400+ models), connection testing, and parameter tuning
- **Knowledge Base Management**: Document upload and processing for PDF, Word, Excel, CSV files with automatic text extraction, plus custom AI instructions tab
- **Product Offers**: Excel-based offer management with discount pricing and batch import
- **Merchant Feed Integration**: Real XML feed parsing with Google Merchant format support and product synchronization

# External Dependencies

## AI/ML Services
- **OpenRouter API**: External LLM service for chat completions with 400+ model access
- **Dynamic Model Loading**: Real-time fetching of available models from OpenRouter
- **Planned Integrations**: Local embedding models (sentence-transformers/all-MiniLM-L6-v2)
- **Vector Database**: ChromaDB integration planned for similarity search

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting
- **Connection**: Environment-based DATABASE_URL configuration

## File Processing
- **Multer**: Multipart form data handling for file uploads
- **File Types**: Support for PDF, Word, Excel, CSV document processing

## UI/UX Libraries
- **Radix UI**: Comprehensive component primitives for accessibility
- **Lucide React**: Icon library for consistent iconography
- **React Day Picker**: Calendar and date selection components
- **Recharts**: Data visualization and charting capabilities

## Development Tools
- **Vite**: Fast development server and build tool
- **TypeScript**: Type safety across frontend and backend
- **ESBuild**: Fast JavaScript bundling for production
- **PostCSS**: CSS processing with Tailwind CSS

## Third-Party Integrations
- **Google Merchant Feed**: XML feed parsing for product catalog
- **Replit Platform**: Development environment with custom plugins
- **Session Storage**: PostgreSQL-based session management