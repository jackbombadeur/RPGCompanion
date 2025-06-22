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
- PostgreSQL database

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd nerve-combat-ttrpg
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory with:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/nerve_combat
   SESSION_SECRET=your-session-secret-key-here
   ```

   **Note:** Authentication has been removed for demo purposes. The app runs without any login requirements.

   **For a quick start without PostgreSQL setup:**
   You can also run with just:
   ```env
   SESSION_SECRET=demo-secret-key-change-in-production
   ```
   And the app will use an in-memory database (data won't persist between restarts).

4. **Set up the database**
   ```bash
   # Create the database schema
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`

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