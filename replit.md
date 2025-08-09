# Overview

This is a full-stack e-commerce AI chatbot application for KarjiStore.com. It features an intelligent sales assistant that combines Retrieval-Augmented Generation (RAG) with product recommendations. The system includes a React-based chat interface and an admin dashboard for managing knowledge base content, product data, and AI configuration.

## Recent Changes (August 2025)
- ✅ Fixed conversation flow imperfections at purchase confirmation stage
- ✅ Enhanced gender filtering to properly exclude opposite-gender products 
- ✅ Implemented purchase confirmation detection to prevent unrelated product searches
- ✅ Updated intent recognition to handle "Yes, I want to buy this" properly
- ✅ Improved follow-up suggestions to be contextually appropriate for purchase flow
- ✅ Added purchase-specific system prompts to guide checkout assistance instead of product browsing

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