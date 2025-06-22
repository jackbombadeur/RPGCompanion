# Nerve Combat TTRPG - System Documentation

## Overview

Nerve Combat is a multiplayer tabletop role-playing game (TTRPG) web application where players engage in sentence-based combat using word potency and dice rolling mechanics. The system supports up to 5 players per session with one Game Master (GM) who controls encounters and manages the game flow.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Authentication**: Replit Auth with OpenID Connect (OIDC)
- **Session Management**: Express sessions with PostgreSQL storage
- **Real-time Communication**: WebSocket server for live game updates
- **API Design**: RESTful endpoints with JSON responses

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM for type-safe database operations
- **Session Storage**: PostgreSQL table for session persistence
- **Schema Management**: Drizzle Kit for migrations and schema management

## Key Components

### Database Schema
The application uses the following core entities:

1. **Users**: Stores user authentication data from Replit Auth
2. **Game Sessions**: Manages game sessions with unique codes and GM assignment
3. **Session Players**: Tracks players in each session with nerve values
4. **Words**: Dictionary of words with potency values for combat
5. **Combat Log**: Records all combat actions and dice rolls
6. **Sessions**: Required table for Express session storage

### Authentication System
- **Provider**: Demo mode with default user (no authentication required)
- **Flow**: Automatic authentication with demo user for development
- **Session Management**: Server-side sessions with PostgreSQL storage
- **Security**: HTTPS-only cookies with 7-day expiration

### Real-time Features
- **WebSocket Server**: Handles live updates for all players in a session
- **Event Broadcasting**: Session-specific message broadcasting
- **Supported Events**: Player joins, nerve updates, word creation, combat actions, encounter updates

### Game Mechanics
- **Nerve System**: Players start with nerve points that decrease during combat
- **Word Potency**: Each word has a potency value that modifies dice rolls
- **Dice Rolling**: 2d6 + word potency for combat resolution
- **Combat Sentences**: Players create sentences using dictionary words for actions

## Data Flow

### Session Creation Flow
1. GM creates session with name
2. System generates unique 6-character code
3. Session stored in database with GM assignment
4. GM can set encounter sentences and manage words

### Player Join Flow
1. Player enters session code
2. System validates code and creates player record
3. Player added to session with starting nerve value
4. Real-time notification sent to all session participants

### Combat Action Flow
1. Player composes sentence and selects words from dictionary
2. System calculates total potency from selected words
3. Player rolls 2d6, adds potency modifier
4. Action and result logged to combat log
5. Real-time broadcast to all session participants

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Neon PostgreSQL serverless driver
- **drizzle-orm**: Type-safe ORM for database operations
- **express**: Web server framework
- **ws**: WebSocket server implementation
- **@tanstack/react-query**: Client-side state management

### UI Dependencies
- **@radix-ui/***: Headless UI primitives
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library
- **react-hook-form**: Form handling
- **wouter**: Lightweight routing

### Authentication Dependencies
- **openid-client**: OIDC authentication client
- **passport**: Authentication middleware
- **connect-pg-simple**: PostgreSQL session store

## Deployment Strategy

### Development Environment
- **Command**: `npm run dev`
- **Port**: 5000 (configured in .replit)
- **Hot Reload**: Vite HMR for frontend, tsx watch mode for backend
- **Database**: Requires DATABASE_URL environment variable

### Production Build
- **Frontend Build**: Vite builds to `dist/public`
- **Backend Build**: esbuild bundles server to `dist/index.js`
- **Start Command**: `npm run start`
- **Deployment Target**: Replit Autoscale with external port 80

### Environment Requirements
- **DATABASE_URL**: PostgreSQL connection string
- **SESSION_SECRET**: Secret for session encryption

## User Preferences

Preferred communication style: Simple, everyday language.

## Changelog

Changelog:
- June 22, 2025. Initial setup
- June 22, 2025. Modified authentication system from Replit Auth to Google OAuth for easier local development
- June 22, 2025. Removed authentication entirely for demo mode - app now works without any login requirements