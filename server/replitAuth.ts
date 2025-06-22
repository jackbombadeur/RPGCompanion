import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
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

// Create a default user for demo purposes
async function createDefaultUser() {
  const defaultUserId = "demo-user-1";
  const existingUser = await storage.getUser(defaultUserId);
  
  if (!existingUser) {
    return await storage.upsertUser({
      id: defaultUserId,
      email: "demo@example.com",
      firstName: "Demo",
      lastName: "User",
      profileImageUrl: null,
    });
  }
  
  return existingUser;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  
  // Create default user on startup
  await createDefaultUser();

  // Mock auth routes for demo
  app.get("/api/login", (req, res) => {
    res.redirect("/");
  });

  app.get("/api/logout", (req, res) => {
    res.redirect("/");
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // For demo purposes, always authenticate with default user
  const defaultUser = await createDefaultUser();
  (req as any).user = { id: defaultUser.id, profile: defaultUser };
  next();
};
