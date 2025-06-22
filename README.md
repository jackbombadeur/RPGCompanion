# Nerve Combat TTRPG

A multiplayer tabletop role-playing game web application where players engage in sentence-based combat using word potency and dice rolling mechanics.

## Features

- **Multiplayer Sessions**: Up to 5 players per session with one Game Master
- **Real-time Communication**: WebSocket support for live game updates
- **Nerve-Based Combat**: Players start with 8 nerve points, lose nerve when creating words
- **Word Dictionary**: Create words with potency values for combat bonuses
- **Dice Rolling**: 2d6 + word potency combat resolution system
- **Turn-Based Combat**: Turn order based on current nerve levels

## Local Development Setup

### Prerequisites

- Node.js 18+ installed
- Optional: PostgreSQL database (for persistent data)

### Quick Start (Windows)

1. **Clone and install:**
   ```cmd
   git clone <your-repo-url>
   cd nerve-combat-ttrpg
   npm install
   ```

2. **Create `.env` file:**
   ```cmd
   echo SESSION_SECRET=demo-secret-key > .env
   ```

3. **Start the application:**
   ```cmd
   start-windows.bat
   ```

4. **Open browser:** `http://localhost:5000`

### Adding Database (Optional - for persistent data)

By default, the app runs with in-memory storage. To add persistent PostgreSQL storage:

**Option 1: Local PostgreSQL**
1. **Install PostgreSQL** on your system
2. **Create database:**
   ```sql
   CREATE DATABASE nerve_combat;
   ```
3. **Update `.env` file:**
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/nerve_combat
   SESSION_SECRET=demo-secret-key
   ```
4. **Initialize database schema:**
   ```cmd
   npm run db:push
   ```

**Option 2: Free Cloud Database (Neon)**
1. **Sign up at** [neon.tech](https://neon.tech) (free tier available)
2. **Create a new project** and copy the connection string
3. **Update `.env` file:**
   ```env
   DATABASE_URL=postgresql://username:password@hostname/database?sslmode=require
   SESSION_SECRET=demo-secret-key
   ```
4. **Initialize database schema:**
   ```cmd
   npm run db:push
   ```

**Option 3: Docker PostgreSQL (if you have Docker)**
1. **Start PostgreSQL container:**
   ```cmd
   docker run --name nerve-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=nerve_combat -p 5432:5432 -d postgres:15
   ```
2. **Update `.env` file:**
   ```env
   DATABASE_URL=postgresql://postgres:password@localhost:5432/nerve_combat
   SESSION_SECRET=demo-secret-key
   ```
3. **Initialize database schema:**
   ```cmd
   npm run db:push
   ```

### Quick Start (Mac/Linux)

1. **Clone and install:**
   ```bash
   git clone <your-repo-url>
   cd nerve-combat-ttrpg
   npm install
   ```

2. **Create `.env` file:**
   ```bash
   echo "SESSION_SECRET=demo-secret-key" > .env
   ```

3. **Start the application:**
   ```bash
   ./start-unix.sh
   ```

4. **Open browser:** `http://localhost:5000`

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm run start
```

### Database Commands

```bash
# Push schema changes to database
npm run db:push

# Generate database migrations
npm run db:generate

# Run database studio (optional)
npm run db:studio
```

## Game Rules

### Setup
- Each player starts with 8 nerve points
- GM creates encounter with descriptive sentence
- Players must have at least 6 words in their dictionary

### Word Creation
- Players lose nerve equal to the word's potency when creating words
- GM assigns potency values to newly defined words
- All players can see defined word meanings

### Combat
- Turn order based on current nerve (highest goes first)
- Players create sentences using 2-3 owned words minimum
- Roll 2d6 + combined word potency for final result
- Only 3 words count toward potency modifier

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSocket (ws library)
- **Authentication**: Demo mode (no auth required)
- **Build Tool**: Vite

## Project Structure

```
├── client/src/          # React frontend
│   ├── components/      # UI components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utilities and configurations
│   └── pages/          # Page components
├── server/             # Express backend
│   ├── db.ts           # Database connection
│   ├── routes.ts       # API routes
│   ├── storage.ts      # Data access layer
│   └── replitAuth.ts   # Authentication setup
├── shared/             # Shared types and schemas
│   └── schema.ts       # Database schema and types
└── package.json        # Dependencies and scripts
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details