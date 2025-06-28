import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

// Generate unique user ID
function generateUserId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Generate unique email
function generateEmail(): string {
  const adjectives = ['swift', 'brave', 'mystic', 'shadow', 'golden', 'silver', 'crimson', 'azure', 'emerald', 'violet'];
  const nouns = ['warrior', 'mage', 'rogue', 'knight', 'archer', 'druid', 'wizard', 'paladin', 'ranger', 'monk'];
  const numbers = Math.floor(Math.random() * 1000);
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adjective}.${noun}${numbers}@adventure.com`;
}

// Generate unique name
function generateName(): { firstName: string; lastName: string } {
  const firstNames = ['Aria', 'Thorne', 'Kael', 'Lyra', 'Raven', 'Zephyr', 'Nova', 'Orion', 'Sage', 'Vex'];
  const lastNames = ['Stormwind', 'Shadowbane', 'Fireheart', 'Moonwhisper', 'Starweaver', 'Darkforge', 'Lightbringer', 'Nightshade', 'Dawnseeker', 'Frostborn'];
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  return { firstName, lastName };
}

// Create a unique user
async function createUniqueUser() {
  const userId = generateUserId();
  const email = generateEmail();
  const { firstName, lastName } = generateName();
  
  return await storage.upsertUser({
    id: userId,
    email,
    firstName,
    lastName,
    profileImageUrl: null,
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Mock auth routes for demo
  app.get("/api/login", (req, res) => {
    res.redirect("/");
  });

  app.get("/api/logout", (req, res) => {
    res.redirect("/");
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // For demo purposes, create a unique user for each request
  const uniqueUser = await createUniqueUser();
  (req as any).user = { id: uniqueUser.id, profile: uniqueUser };
  next();
};
