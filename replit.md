# Overview

This is a full-stack e-commerce AI chatbot application for KarjiStore.com. It functions as an intelligent sales assistant combining Retrieval-Augmented Generation (RAG) with product recommendations. The system features a React-based chat interface and an admin dashboard for managing knowledge base content, product data, and AI configurations. The project aims to provide a sophisticated, elegant, and user-friendly shopping experience, enhancing customer interaction and driving sales through intelligent assistance and personalized product discovery. The business vision is to set a new standard for AI-driven e-commerce, offering a seamless and luxurious shopping journey.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript (Vite build tool)
- **UI Library**: Radix UI components with shadcn/ui design system
- **Styling**: Tailwind CSS with custom CSS variables
- **State Management**: TanStack Query for server state
- **Routing**: Wouter for client-side routing
- **Form Handling**: React Hook Form with Zod validation
- **UI/UX Decisions**:
    - Current Theme: AI Copilot Design System with clean, minimal aesthetic and warm accents
    - Color Palette: Pure white backgrounds, dark charcoal text, warm terracotta accents
    - Typography: System font stack for optimal performance and readability
    - Consistent glassmorphism effects, 12px border radius, and subtle animations
    - Responsive design with touch-friendly targets and mobile optimizations
    - Custom animations: breathe, particle-float, typewriter, glow-pulse, fade-in, typing-pulse
    - MeghTechnologies branding integrated in chat interfaces

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL support
- **File Handling**: Multer for document uploads
- **Session Management**: Express sessions with PostgreSQL store
- **API Design**: RESTful APIs with structured error handling

## Data Storage Architecture
- **Primary Database**: JSON-based file storage system within the `/data/` directory.
- **Storage Files**: `users.json`, `documents.json`, `products.json`, `offers.json`, `api-config.json`, `merchant-feeds.json`, `uploaded-files.json`.
- **File Storage System**: Organized upload folders (`/uploads/documents/`, `/uploads/merchant-feeds/`, `/uploads/offers/`, `/uploads/embeddings/`, `/uploads/processed/`).
- **Vector Storage Strategy**: ChromaDB for vector embeddings, with in-memory fallback.

## RAG Implementation with Langchain
- **Framework**: Langchain for comprehensive RAG pipeline.
- **Primary Vector Storage**: ChromaDB with in-memory fallback.
- **Text Processing**: Langchain RecursiveCharacterTextSplitter for document chunking.
- **Embedding Model**: HuggingFace Transformers (all-MiniLM-L6-v2) for local embeddings.
- **Vector Storage**: Dual approach with Langchain MemoryVectorStore and ChromaDB persistence.
- **Document Processing**: Automated chunking and vectorization of uploaded documents.
- **Product Indexing**: Intelligent product content processing for e-commerce search.
- **Context Retrieval**: Advanced similarity search combining documents and product data.
- **Persistence Strategy**: Processed documents and chunks stored locally in `/uploads/processed/`.

## Chat System Architecture
- **Message Flow**: User input → Session management → RAG context retrieval → Conversational context → LLM processing → Structured response.
- **Product Recommendations**: Integrated product cards with preference-based filtering.
- **Conversational Memory**: Full session-based conversation history with user preference learning.
- **Context Management**: Maintains conversation history, user preferences, and relevant product context.
- **Session Management**: Automatic session creation, preference tracking, and cleanup with 30-minute timeout.
- **Key Features**: Enhanced intent recognition, intelligent alternative suggestions, dynamic follow-up questions, comprehensive discount system, and robust gender-aware search scoring.

## Admin Panel Features
- **API Configuration**: OpenRouter API key setup with live model fetching, connection testing, and parameter tuning.
- **Knowledge Base Management**: Document upload and processing (PDF, Word, Excel, CSV) with text extraction, plus custom AI instructions.
- **Product Offers**: Excel-based offer management with discount pricing and batch import.
- **Merchant Feed Integration**: XML feed parsing with Google Merchant format support and product synchronization.

# External Dependencies

## AI/ML Services
- **OpenRouter API**: External LLM service for chat completions, providing access to a wide range of models.
- **ChromaDB**: Vector database for similarity search.

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting.

## File Processing
- **Multer**: Handles multipart form data for file uploads, supporting PDF, Word, Excel, and CSV documents.

## UI/UX Libraries
- **Radix UI**: Provides accessible component primitives.
- **Lucide React**: Icon library.
- **React Day Picker**: Calendar and date selection components.
- **Recharts**: For data visualization.

## Development Tools
- **Vite**: Fast development server and build tool.
- **TypeScript**: Ensures type safety.
- **ESBuild**: Fast JavaScript bundling.
- **PostCSS**: CSS processing with Tailwind CSS.

## Third-Party Integrations
- **Google Merchant Feed**: For XML feed parsing of product catalogs.