# Overview

This is a full-stack e-commerce AI chatbot application for KarjiStore.com. It features an intelligent sales assistant that combines Retrieval-Augmented Generation (RAG) with product recommendations. The system includes a React-based chat interface and an admin dashboard for managing knowledge base content, product data, and AI configuration.

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
- **Primary Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Schema Design**: 
  - Users table for authentication
  - Documents table for knowledge base files
  - Products table for e-commerce catalog
  - Offers table for promotional pricing
  - API configuration table for OpenRouter settings
  - Merchant feeds table for external product data
  - Uploaded files table for tracking file storage and processing
  - Vector embeddings are stored in ChromaDB for optimal performance
- **File Storage System**: Organized upload folders with automatic directory management
  - `/uploads/documents/` - PDF, Word, Excel, CSV files
  - `/uploads/merchant-feeds/` - XML feed data and processed product information
  - `/uploads/offers/` - Offer spreadsheets and processed data
  - `/uploads/embeddings/` - Vector embedding backups
  - `/uploads/processed/` - Processed document chunks and extracted data
- **Dual Storage Strategy**: Critical data stored in both PostgreSQL and file system for redundancy

## RAG Implementation
- **Primary Vector Storage**: ChromaDB as the main vector database for all embeddings
- **Similarity Search**: Vector similarity using local embedding models (all-MiniLM-L6-v2)
- **Context Retrieval**: Combines document content and product information with vector search
- **Embedding Strategy**: Integrated @xenova/transformers for local embeddings
- **Fallback Storage**: In-memory storage with file system backup when ChromaDB unavailable
- **Document Processing**: Langchain text splitters with support for PDF, Word, Excel, CSV files
- **Search Algorithm**: ChromaDB vector similarity with cosine similarity fallback
- **Data Persistence**: All scraped data, documents, and file metadata stored in PostgreSQL

## Chat System Architecture
- **Message Flow**: User input → RAG context retrieval → LLM processing → Structured response
- **Product Recommendations**: Integrated product cards within chat responses
- **Streaming**: Designed for real-time message streaming
- **Context Management**: Maintains conversation history and relevant product context

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