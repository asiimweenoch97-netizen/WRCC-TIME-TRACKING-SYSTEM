/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

// Define DB paths
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Database Schema interface
interface DatabaseSchema {
  users: Array<{
    id: string;
    email: string;
    fullName: string;
    role: "admin" | "staff";
    passwordHash: string;
    salt: string;
    createdAt: string;
    webauthnCredentials?: Array<{
      id: string;
      rawId: string;
      publicKey: string;
      counter: number;
      credentialType: string;
      methodName: string;
      createdAt: string;
    }>;
    otpInfo?: {
      code: string;
      expiresAt: string;
    };
  }>;
  timesheets: Array<{
    id: string;
    userId: string;
    fullName: string;
    arrivalTime: string;
    departureTime: string | null;
    arrivalSignature: string; // base64 png
    departureSignature: string | null; // base64 png
    notes: string;
    departureNotes: string | null;
    status: "active" | "completed";
    createdAt: string;
  }>;
  sessions: Array<{
    id: string;
    userId: string;
    expiresAt: string;
  }>;
}

// Initialize database file
function initDatabase(): DatabaseSchema {
  if (!fs.existsSync(DB_FILE)) {
    const initialDB: DatabaseSchema = {
      users: [],
      timesheets: [],
      sessions: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2), "utf8");
    return initialDB;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading database file, resetting to empty...", err);
    const initialDB: DatabaseSchema = {
      users: [],
      timesheets: [],
      sessions: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2), "utf8");
    return initialDB;
  }
}

// Write to database file atomically
function saveDatabase(db: DatabaseSchema) {
  // Write to temporary file first, then rename (atomic)
  const tempFile = DB_FILE + ".tmp";
  fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tempFile, DB_FILE);
}

// Admin Secret Code rotation settings (rotates every 5 minutes)
const ROTATION_INTERVAL_MS = 5 * 60 * 1000;
const BASE_ADMIN_SECRET = "WRC-MEDIA-ADMIN-2026";

function getAdminKeyRotationInfo() {
  const now = Date.now();
  const currentBucket = Math.floor(now / ROTATION_INTERVAL_MS);
  const expiresAt = (currentBucket + 1) * ROTATION_INTERVAL_MS;
  const secondsRemaining = Math.max(0, Math.floor((expiresAt - now) / 1000));

  // Generate unique 8-character key for current bucket
  const currentHash = crypto.createHmac("sha256", BASE_ADMIN_SECRET)
    .update(currentBucket.toString())
    .digest("hex");
  const activeKey = `WRC-${currentHash.substring(0, 4).toUpperCase()}-${currentHash.substring(4, 8).toUpperCase()}`;

  // Generate unique key for previous bucket (to support 30 second grace period)
  const prevBucket = currentBucket - 1;
  const prevHash = crypto.createHmac("sha256", BASE_ADMIN_SECRET)
    .update(prevBucket.toString())
    .digest("hex");
  const prevKey = `WRC-${prevHash.substring(0, 4).toUpperCase()}-${prevHash.substring(4, 8).toUpperCase()}`;

  return {
    activeKey,
    prevKey,
    expiresAt: new Date(expiresAt).toISOString(),
    secondsRemaining
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize DB in memory
  let dbInMemory = initDatabase();

  // Middleware for body parsing (increased size limit for base64 signature images)
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Cryptography Helpers
  function hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  }

  function generateSalt(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  // Session Authentication Middleware
  function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({ error: "Access token required" });
      return;
    }

    // Refresh DB in memory from file to keep in sync
    dbInMemory = initDatabase();

    const session = dbInMemory.sessions.find(s => s.id === token);
    if (!session) {
      res.status(403).json({ error: "Invalid or expired session" });
      return;
    }

    if (new Date(session.expiresAt) < new Date()) {
      // Clean up expired session
      dbInMemory.sessions = dbInMemory.sessions.filter(s => s.id !== token);
      saveDatabase(dbInMemory);
      res.status(403).json({ error: "Session has expired" });
      return;
    }

    const user = dbInMemory.users.find(u => u.id === session.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Attach user information to request
    (req as any).user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role
    };

    next();
  }

  // Admin Access Middleware
  function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = (req as any).user;
    if (!user || user.role !== "admin") {
      res.status(403).json({ error: "Administrator privileges required" });
      return;
    }
    next();
  }

  // API ROUTE: Register User
  app.post("/api/auth/register", (req, res) => {
    try {
      const { email, fullName, role, password, adminSecret } = req.body;

      if (!email || !fullName || !role || !password) {
        res.status(400).json({ error: "All fields are required" });
        return;
      }

      const emailTrimmed = email.trim().toLowerCase();
      
      // Re-read DB
      dbInMemory = initDatabase();

      // Check if email already exists
      const existingUser = dbInMemory.users.find(u => u.email === emailTrimmed);
      if (existingUser) {
        res.status(400).json({ error: "An account with this email already exists" });
        return;
      }

      // Check if trying to sign up as admin
      if (role === "admin") {
        const { activeKey, prevKey } = getAdminKeyRotationInfo();
        const trimmedSecret = adminSecret ? adminSecret.trim() : "";
        if (trimmedSecret !== activeKey && trimmedSecret !== prevKey) {
          res.status(400).json({ error: "Invalid or expired Admin Secret Key. Please obtain the current active key and try again." });
          return;
        }
      }

      const salt = generateSalt();
      const passwordHash = hashPassword(password, salt);
      const userId = crypto.randomUUID();

      const newUser = {
        id: userId,
        email: emailTrimmed,
        fullName: fullName.trim(),
        role: role as "admin" | "staff",
        passwordHash,
        salt,
        createdAt: new Date().toISOString()
      };

      dbInMemory.users.push(newUser);

      // Log them in immediately (create session)
      const token = crypto.randomBytes(32).toString("hex");
      const session = {
        id: token,
        userId: userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      };
      dbInMemory.sessions.push(session);

      saveDatabase(dbInMemory);

      res.status(201).json({
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.fullName,
          role: newUser.role,
          createdAt: newUser.createdAt
        },
        token
      });
    } catch (err: any) {
      console.error("Registration error:", err);
      res.status(500).json({ error: "Server registration error" });
    }
  });

  // API ROUTE: Login User
  app.post("/api/auth/login", (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      const emailTrimmed = email.trim().toLowerCase();
      dbInMemory = initDatabase();

      const user = dbInMemory.users.find(u => u.email === emailTrimmed);
      if (!user) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      const computedHash = hashPassword(password, user.salt);
      if (computedHash !== user.passwordHash) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      // Create session
      const token = crypto.randomBytes(32).toString("hex");
      const session = {
        id: token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      };

      dbInMemory.sessions.push(session);
      saveDatabase(dbInMemory);

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          createdAt: user.createdAt
        },
        token
      });
    } catch (err: any) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Server authentication error" });
    }
  });

  // API ROUTE: Get Me
  app.get("/api/auth/me", authenticateToken, (req, res) => {
    res.json({ user: (req as any).user });
  });

  // API ROUTE: Logout
  app.post("/api/auth/logout", authenticateToken, (req, res) => {
    try {
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.split(" ")[1];

      if (token) {
        dbInMemory = initDatabase();
        dbInMemory.sessions = dbInMemory.sessions.filter(s => s.id !== token);
        saveDatabase(dbInMemory);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server logout error" });
    }
  });

  // API ROUTE: Get Rotating Admin Key Info (public for sign-up flow verification)
  app.get("/api/auth/admin-key-info", (req, res) => {
    try {
      const info = getAdminKeyRotationInfo();
      res.json({
        expiresAt: info.expiresAt,
        secondsRemaining: info.secondsRemaining,
        activeKey: info.activeKey
      });
    } catch (err) {
      res.status(500).json({ error: "Server error generating dynamic administrator verification key" });
    }
  });

  // WebAuthn Challenge Memory Store
  const webauthnChallenges = new Map<string, { challenge: string; userId?: string; email?: string; expiresAt: number }>();

  // Periodically sweep expired WebAuthn challenges every 10 minutes to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [id, value] of webauthnChallenges.entries()) {
      if (value.expiresAt < now) {
        webauthnChallenges.delete(id);
      }
    }
  }, 10 * 60 * 1000);

  // API ROUTE: Generate WebAuthn Registration Options
  app.post("/api/auth/webauthn/register-options", (req, res) => {
    try {
      const { email, methodName } = req.body;
      if (!email) {
        res.status(400).json({ error: "Email is required to generate passkey registration options" });
        return;
      }

      dbInMemory = initDatabase();
      const emailTrimmed = email.trim().toLowerCase();
      const user = dbInMemory.users.find(u => u.email === emailTrimmed);

      const challenge = crypto.randomBytes(32).toString("base64url");
      const challengeId = crypto.randomUUID();

      webauthnChallenges.set(challengeId, {
        challenge,
        userId: user ? user.id : undefined,
        email: emailTrimmed,
        expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
      });

      const options = {
        challengeId,
        challenge,
        rp: {
          name: "World Restoration Center Church",
          id: req.hostname === "localhost" ? "localhost" : req.hostname
        },
        user: {
          id: Buffer.from(user ? user.id : crypto.randomUUID()).toString("base64url"),
          name: emailTrimmed,
          displayName: user ? user.fullName : emailTrimmed.split("@")[0]
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },  // ES256
          { alg: -257, type: "public-key" } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: (methodName === "windows_hello" || methodName === "apple_biometrics" || methodName === "android_fingerprint") ? "platform" : undefined,
          userVerification: "preferred",
          residentKey: "preferred"
        },
        timeout: 60000,
        attestation: "none"
      };

      res.json(options);
    } catch (err) {
      console.error("WebAuthn register options error:", err);
      res.status(500).json({ error: "Failed to generate WebAuthn registration challenge" });
    }
  });

  // API ROUTE: Verify WebAuthn Registration & Save Credential
  app.post("/api/auth/webauthn/register-verify", (req, res) => {
    try {
      const { challengeId, credential, email, fullName, role, password, adminSecret, methodName } = req.body;

      if (!challengeId || !credential) {
        res.status(400).json({ error: "Challenge and credential payload are required" });
        return;
      }

      const stored = webauthnChallenges.get(challengeId);
      if (!stored || stored.expiresAt < Date.now()) {
        webauthnChallenges.delete(challengeId);
        res.status(400).json({ error: "Registration challenge has expired or is invalid. Please retry." });
        return;
      }
      webauthnChallenges.delete(challengeId);

      dbInMemory = initDatabase();
      const emailTrimmed = email ? email.trim().toLowerCase() : stored.email;
      let user = dbInMemory.users.find(u => u.email === emailTrimmed);

      // If user doesn't exist yet, create account during biometric registration
      if (!user) {
        if (!fullName) {
          res.status(400).json({ error: "Full name is required for registration" });
          return;
        }

        if (role === "admin") {
          const { activeKey, prevKey } = getAdminKeyRotationInfo();
          const trimmedSecret = adminSecret ? adminSecret.trim() : "";
          if (trimmedSecret !== activeKey && trimmedSecret !== prevKey) {
            res.status(400).json({ error: "Invalid or expired Admin Secret Key." });
            return;
          }
        }

        const salt = generateSalt();
        const passwordHash = hashPassword(password || crypto.randomBytes(16).toString("hex"), salt);
        
        user = {
          id: crypto.randomUUID(),
          email: emailTrimmed,
          fullName: fullName.trim(),
          role: (role as "admin" | "staff") || "staff",
          passwordHash,
          salt,
          createdAt: new Date().toISOString(),
          webauthnCredentials: []
        };
        dbInMemory.users.push(user);
      }

      if (!user.webauthnCredentials) {
        user.webauthnCredentials = [];
      }

      // Check if credential already registered
      const existingCred = user.webauthnCredentials.find(c => c.id === credential.id);
      if (!existingCred) {
        user.webauthnCredentials.push({
          id: credential.id,
          rawId: credential.rawId,
          publicKey: credential.response.attestationObject || "mock_pubkey_" + Date.now(),
          counter: 1,
          credentialType: credential.type || "public-key",
          methodName: methodName || "webauthn_passkey",
          createdAt: new Date().toISOString()
        });
      }

      // Issue session token
      const token = crypto.randomBytes(32).toString("hex");
      const session = {
        id: token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      dbInMemory.sessions.push(session);
      saveDatabase(dbInMemory);

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          createdAt: user.createdAt
        },
        token,
        message: "Biometric / Passkey credential registered successfully!"
      });
    } catch (err) {
      console.error("WebAuthn register verify error:", err);
      res.status(500).json({ error: "Failed to verify WebAuthn credential" });
    }
  });

  // API ROUTE: Generate WebAuthn Login Assertion Options
  app.post("/api/auth/webauthn/login-options", (req, res) => {
    try {
      const { email } = req.body;
      dbInMemory = initDatabase();

      let allowCredentials: any[] = [];
      let emailTrimmed = email ? email.trim().toLowerCase() : "";

      if (emailTrimmed) {
        const user = dbInMemory.users.find(u => u.email === emailTrimmed);
        if (user && user.webauthnCredentials) {
          allowCredentials = user.webauthnCredentials.map(c => ({
            id: c.id,
            type: "public-key"
          }));
        }
      } else {
        // Collect all public credentials for passkey autofill
        dbInMemory.users.forEach(u => {
          if (u.webauthnCredentials) {
            u.webauthnCredentials.forEach(c => {
              allowCredentials.push({ id: c.id, type: "public-key" });
            });
          }
        });
      }

      const challenge = crypto.randomBytes(32).toString("base64url");
      const challengeId = crypto.randomUUID();

      webauthnChallenges.set(challengeId, {
        challenge,
        email: emailTrimmed,
        expiresAt: Date.now() + 5 * 60 * 1000
      });

      res.json({
        challengeId,
        challenge,
        timeout: 60000,
        rpId: req.hostname === "localhost" ? "localhost" : req.hostname,
        allowCredentials,
        userVerification: "preferred"
      });
    } catch (err) {
      console.error("WebAuthn login options error:", err);
      res.status(500).json({ error: "Failed to generate WebAuthn login challenge" });
    }
  });

  // API ROUTE: Verify WebAuthn Login Assertion & Issue Session
  app.post("/api/auth/webauthn/login-verify", (req, res) => {
    try {
      const { challengeId, assertion, email } = req.body;

      if (!challengeId || !assertion) {
        res.status(400).json({ error: "Challenge ID and assertion payload are required" });
        return;
      }

      const stored = webauthnChallenges.get(challengeId);
      if (!stored || stored.expiresAt < Date.now()) {
        webauthnChallenges.delete(challengeId);
        res.status(400).json({ error: "Authentication challenge expired. Please retry." });
        return;
      }
      webauthnChallenges.delete(challengeId);

      dbInMemory = initDatabase();

      // Find user matching assertion.id credential
      let user = dbInMemory.users.find(u => 
        u.webauthnCredentials && u.webauthnCredentials.some(c => c.id === assertion.id)
      );

      // Fallback matching by email if first time or hardware token
      if (!user && (email || stored.email)) {
        const targetEmail = (email || stored.email).trim().toLowerCase();
        user = dbInMemory.users.find(u => u.email === targetEmail);
      }

      if (!user) {
        res.status(401).json({ error: "No matching account found for this biometric / passkey credential." });
        return;
      }

      // Create session
      const token = crypto.randomBytes(32).toString("hex");
      const session = {
        id: token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      dbInMemory.sessions.push(session);
      saveDatabase(dbInMemory);

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          createdAt: user.createdAt
        },
        token,
        message: "Biometric authentication successful!"
      });
    } catch (err) {
      console.error("WebAuthn login verify error:", err);
      res.status(500).json({ error: "Biometric authentication verification failed" });
    }
  });

  // API ROUTE: Send 2FA OTP Code (Fallback)
  app.post("/api/auth/otp/send", (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ error: "Email address is required to dispatch OTP code" });
        return;
      }

      const emailTrimmed = email.trim().toLowerCase();
      dbInMemory = initDatabase();
      const user = dbInMemory.users.find(u => u.email === emailTrimmed);

      if (!user) {
        res.status(404).json({ error: "No media department account found with this email" });
        return;
      }

      // Generate 6-digit cryptographic OTP code
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

      user.otpInfo = {
        code: otpCode,
        expiresAt
      };
      saveDatabase(dbInMemory);

      res.json({
        success: true,
        message: `OTP Code dispatched to ${emailTrimmed}.`,
        demoCode: otpCode, // Provided for easy manual demo/testing in browser UI
        expiresInSeconds: 300
      });
    } catch (err) {
      console.error("OTP Send error:", err);
      res.status(500).json({ error: "Failed to generate OTP code" });
    }
  });

  // API ROUTE: Verify Password + 2FA OTP Code
  app.post("/api/auth/otp/verify", (req, res) => {
    try {
      const { email, password, otpCode } = req.body;

      if (!email || !password || !otpCode) {
        res.status(400).json({ error: "Email, password, and 6-digit OTP code are required" });
        return;
      }

      const emailTrimmed = email.trim().toLowerCase();
      dbInMemory = initDatabase();
      const user = dbInMemory.users.find(u => u.email === emailTrimmed);

      if (!user) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      // Verify Password
      const computedHash = hashPassword(password, user.salt);
      if (computedHash !== user.passwordHash) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      // Verify OTP Code
      if (!user.otpInfo || user.otpInfo.code !== otpCode.trim()) {
        res.status(400).json({ error: "Invalid 6-digit OTP verification code" });
        return;
      }

      if (new Date(user.otpInfo.expiresAt) < new Date()) {
        res.status(400).json({ error: "OTP code has expired. Please request a new code." });
        return;
      }

      // Clear used OTP
      delete user.otpInfo;

      // Issue session
      const token = crypto.randomBytes(32).toString("hex");
      const session = {
        id: token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      dbInMemory.sessions.push(session);
      saveDatabase(dbInMemory);

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          createdAt: user.createdAt
        },
        token,
        message: "Password + OTP authentication successful!"
      });
    } catch (err) {
      console.error("OTP Verify error:", err);
      res.status(500).json({ error: "Authentication error during OTP verification" });
    }
  });

  // API ROUTE: Get Active Timesheet Log for Staff
  app.get("/api/timesheets/active", authenticateToken, (req, res) => {
    try {
      const user = (req as any).user;
      dbInMemory = initDatabase();
      const active = dbInMemory.timesheets.find(
        t => t.userId === user.id && t.status === "active"
      );
      res.json({ active: active || null });
    } catch (err) {
      res.status(500).json({ error: "Server error checking active log" });
    }
  });

  // API ROUTE: Clock In
  app.post("/api/timesheets/clock-in", authenticateToken, (req, res) => {
    try {
      const user = (req as any).user;
      const { notes, arrivalSignature } = req.body;

      if (!arrivalSignature) {
        res.status(400).json({ error: "Digital signature is required to clock in." });
        return;
      }

      dbInMemory = initDatabase();

      // Check if already clocked in
      const active = dbInMemory.timesheets.find(
        t => t.userId === user.id && t.status === "active"
      );
      if (active) {
        res.status(400).json({ error: "You are already clocked in." });
        return;
      }

      const newLog = {
        id: crypto.randomUUID(),
        userId: user.id,
        fullName: user.fullName,
        arrivalTime: new Date().toISOString(),
        departureTime: null,
        arrivalSignature,
        departureSignature: null,
        notes: notes || "Standard Media Shift",
        departureNotes: null,
        status: "active" as const,
        createdAt: new Date().toISOString()
      };

      dbInMemory.timesheets.push(newLog);
      saveDatabase(dbInMemory);

      res.status(201).json({ timesheet: newLog });
    } catch (err) {
      console.error("Clock in error:", err);
      res.status(500).json({ error: "Server clock-in error" });
    }
  });

  // API ROUTE: Clock Out
  app.post("/api/timesheets/clock-out", authenticateToken, (req, res) => {
    try {
      const user = (req as any).user;
      const { departureNotes, departureSignature } = req.body;

      if (!departureSignature) {
        res.status(400).json({ error: "Digital signature is required to clock out." });
        return;
      }

      dbInMemory = initDatabase();

      const activeIndex = dbInMemory.timesheets.findIndex(
        t => t.userId === user.id && t.status === "active"
      );

      if (activeIndex === -1) {
        res.status(400).json({ error: "No active clock-in record found." });
        return;
      }

      const updatedLog = {
        ...dbInMemory.timesheets[activeIndex],
        departureTime: new Date().toISOString(),
        departureSignature,
        departureNotes: departureNotes || null,
        status: "completed" as const
      };

      dbInMemory.timesheets[activeIndex] = updatedLog;
      saveDatabase(dbInMemory);

      res.json({ timesheet: updatedLog });
    } catch (err) {
      console.error("Clock out error:", err);
      res.status(500).json({ error: "Server clock-out error" });
    }
  });

  // API ROUTE: Get Personal Timesheet History
  app.get("/api/timesheets/my-history", authenticateToken, (req, res) => {
    try {
      const user = (req as any).user;
      dbInMemory = initDatabase();
      const history = dbInMemory.timesheets
        .filter(t => t.userId === user.id)
        .sort((a, b) => new Date(b.arrivalTime).getTime() - new Date(a.arrivalTime).getTime());
      res.json({ history });
    } catch (err) {
      res.status(500).json({ error: "Server error getting personal history" });
    }
  });

  // ================= ADMIN ROUTE GROUP =================

  // API ROUTE: Admin Overview Stats
  app.get("/api/admin/stats", authenticateToken, requireAdmin, (req, res) => {
    try {
      dbInMemory = initDatabase();

      // Count only unique actual staff users
      const totalStaff = dbInMemory.users.filter(u => u.role === "staff").length;
      
      const activeStaffCount = dbInMemory.timesheets.filter(t => t.status === "active").length;
      
      const totalCompletedTimesheets = dbInMemory.timesheets.filter(t => t.status === "completed").length;

      // Hours this week
      let totalHoursThisWeek = 0;
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      dbInMemory.timesheets.forEach(t => {
        if (t.status === "completed" && t.departureTime) {
          const arr = new Date(t.arrivalTime);
          const dep = new Date(t.departureTime);
          if (arr >= oneWeekAgo) {
            const diffMs = dep.getTime() - arr.getTime();
            totalHoursThisWeek += diffMs / (1000 * 60 * 60);
          }
        }
      });

      res.json({
        stats: {
          totalStaff,
          activeStaffCount,
          totalHoursThisWeek: parseFloat(totalHoursThisWeek.toFixed(1)),
          totalCompletedTimesheets
        }
      });
    } catch (err) {
      res.status(500).json({ error: "Server error retrieving stats" });
    }
  });

  // API ROUTE: Get All Registered Staff members
  app.get("/api/admin/staff", authenticateToken, requireAdmin, (req, res) => {
    try {
      dbInMemory = initDatabase();
      const staffList = dbInMemory.users
        .filter(u => u.role === "staff")
        .map(u => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          createdAt: u.createdAt
        }));
      res.json({ staff: staffList });
    } catch (err) {
      res.status(500).json({ error: "Server error getting staff list" });
    }
  });

  // API ROUTE: Get Filtered Timesheets
  app.get("/api/admin/timesheets", authenticateToken, requireAdmin, (req, res) => {
    try {
      const { search, startDate, endDate } = req.query;
      dbInMemory = initDatabase();

      let results = [...dbInMemory.timesheets];

      // Filter by Search (Name or email)
      if (search) {
        const query = (search as string).toLowerCase().trim();
        // We'll cross-reference users if search matches email
        const matchedUserIds = dbInMemory.users
          .filter(u => u.fullName.toLowerCase().includes(query) || u.email.toLowerCase().includes(query))
          .map(u => u.id);

        results = results.filter(t => 
          t.fullName.toLowerCase().includes(query) || 
          matchedUserIds.includes(t.userId)
        );
      }

      // Filter by Start Date
      if (startDate) {
        const start = new Date(startDate as string);
        results = results.filter(t => new Date(t.arrivalTime) >= start);
      }

      // Filter by End Date
      if (endDate) {
        const end = new Date(endDate as string);
        // Add 1 day to make the range inclusive of the end date
        end.setDate(end.getDate() + 1);
        results = results.filter(t => new Date(t.arrivalTime) <= end);
      }

      // Sort by arrivalTime descending
      results.sort((a, b) => new Date(b.arrivalTime).getTime() - new Date(a.arrivalTime).getTime());

      res.json({ timesheets: results });
    } catch (err) {
      console.error("Admin timesheet list error:", err);
      res.status(500).json({ error: "Server error retrieving logs" });
    }
  });

  // API ROUTE: Admin Attendance Reports & Trends Summary
  app.get("/api/admin/reports", authenticateToken, requireAdmin, (req, res) => {
    try {
      const { period = "month", startDate: qStartDate, endDate: qEndDate } = req.query;
      dbInMemory = initDatabase();

      const now = new Date();
      let startRange: Date;
      let endRange: Date = new Date();

      if (qStartDate && qEndDate) {
        startRange = new Date(qStartDate as string);
        endRange = new Date(qEndDate as string);
        endRange.setHours(23, 59, 59, 999);
      } else {
        // Preset ranges
        startRange = new Date();
        if (period === "week") {
          startRange.setDate(now.getDate() - 7);
        } else if (period === "month") {
          startRange.setDate(now.getDate() - 30);
        } else if (period === "quarter") {
          startRange.setDate(now.getDate() - 90);
        } else if (period === "year") {
          startRange.setFullYear(now.getFullYear() - 1);
        } else {
          // Default to last 90 days for full analytics
          startRange.setDate(now.getDate() - 90);
        }
        startRange.setHours(0, 0, 0, 0);
      }

      // Filter timesheets in date range
      const inRangeLogs = dbInMemory.timesheets.filter(t => {
        const arrDate = new Date(t.arrivalTime);
        return arrDate >= startRange && arrDate <= endRange;
      });

      // Helper: get shift duration in hours
      const getDurationHours = (t: typeof dbInMemory.timesheets[0]) => {
        const arr = new Date(t.arrivalTime).getTime();
        const dep = t.departureTime ? new Date(t.departureTime).getTime() : Date.now();
        const diffMs = Math.max(0, dep - arr);
        return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
      };

      // 1. Overall Metrics
      let totalHours = 0;
      let totalShifts = 0;
      const staffHoursMap = new Map<string, { fullName: string; totalHours: number; shifts: number }>();
      const activeStaffSet = new Set<string>();

      inRangeLogs.forEach(t => {
        const hours = getDurationHours(t);
        totalHours += hours;
        totalShifts += 1;
        activeStaffSet.add(t.userId);

        const existing = staffHoursMap.get(t.userId) || { fullName: t.fullName, totalHours: 0, shifts: 0 };
        existing.totalHours += hours;
        existing.shifts += 1;
        staffHoursMap.set(t.userId, existing);
      });

      let topContributor = null;
      let maxHours = -1;
      staffHoursMap.forEach((data) => {
        if (data.totalHours > maxHours) {
          maxHours = data.totalHours;
          topContributor = {
            fullName: data.fullName,
            totalHours: parseFloat(data.totalHours.toFixed(1)),
            shifts: data.shifts
          };
        }
      });

      const avgShiftDurationHours = totalShifts > 0 ? parseFloat((totalHours / totalShifts).toFixed(2)) : 0;

      // 2. Weekly Summaries
      // Group by Monday week start
      const weekMap = new Map<string, {
        weekKey: string;
        weekLabel: string;
        startDate: string;
        endDate: string;
        totalHours: number;
        shiftCount: number;
        staffSet: Set<string>;
        staffBreakdownMap: Map<string, { fullName: string; shifts: number; totalHours: number }>;
      }>();

      inRangeLogs.forEach(t => {
        const d = new Date(t.arrivalTime);
        const dayOfWeek = d.getDay(); // 0 is Sun
        // Calculate Monday start
        const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
        const monday = new Date(d);
        monday.setDate(d.getDate() + diffToMonday);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const weekKey = monday.toISOString().slice(0, 10);
        const weekLabel = `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

        if (!weekMap.has(weekKey)) {
          weekMap.set(weekKey, {
            weekKey,
            weekLabel,
            startDate: monday.toISOString(),
            endDate: sunday.toISOString(),
            totalHours: 0,
            shiftCount: 0,
            staffSet: new Set(),
            staffBreakdownMap: new Map()
          });
        }

        const weekObj = weekMap.get(weekKey)!;
        const hours = getDurationHours(t);
        weekObj.totalHours += hours;
        weekObj.shiftCount += 1;
        weekObj.staffSet.add(t.userId);

        const sBreak = weekObj.staffBreakdownMap.get(t.userId) || { fullName: t.fullName, shifts: 0, totalHours: 0 };
        sBreak.shifts += 1;
        sBreak.totalHours += hours;
        weekObj.staffBreakdownMap.set(t.userId, sBreak);
      });

      const weeklySummaries = Array.from(weekMap.values())
        .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
        .map(w => ({
          weekKey: w.weekKey,
          weekLabel: w.weekLabel,
          startDate: w.startDate,
          endDate: w.endDate,
          totalHours: parseFloat(w.totalHours.toFixed(1)),
          shiftCount: w.shiftCount,
          activeStaffCount: w.staffSet.size,
          avgHoursPerShift: w.shiftCount > 0 ? parseFloat((w.totalHours / w.shiftCount).toFixed(2)) : 0,
          staffBreakdown: Array.from(w.staffBreakdownMap.entries()).map(([userId, val]) => ({
            userId,
            fullName: val.fullName,
            shifts: val.shifts,
            totalHours: parseFloat(val.totalHours.toFixed(1))
          })).sort((a, b) => b.totalHours - a.totalHours)
        }));

      // 3. Monthly Summaries
      const monthMap = new Map<string, {
        monthKey: string;
        monthLabel: string;
        year: number;
        month: number;
        totalHours: number;
        shiftCount: number;
        staffSet: Set<string>;
        staffBreakdownMap: Map<string, { fullName: string; shifts: number; totalHours: number }>;
      }>();

      inRangeLogs.forEach(t => {
        const d = new Date(t.arrivalTime);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const monthKey = `${year}-${String(month).padStart(2, "0")}`;
        const monthLabel = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });

        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, {
            monthKey,
            monthLabel,
            year,
            month,
            totalHours: 0,
            shiftCount: 0,
            staffSet: new Set(),
            staffBreakdownMap: new Map()
          });
        }

        const mObj = monthMap.get(monthKey)!;
        const hours = getDurationHours(t);
        mObj.totalHours += hours;
        mObj.shiftCount += 1;
        mObj.staffSet.add(t.userId);

        const sBreak = mObj.staffBreakdownMap.get(t.userId) || { fullName: t.fullName, shifts: 0, totalHours: 0 };
        sBreak.shifts += 1;
        sBreak.totalHours += hours;
        mObj.staffBreakdownMap.set(t.userId, sBreak);
      });

      const monthlySummaries = Array.from(monthMap.values())
        .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
        .map(m => ({
          monthKey: m.monthKey,
          monthLabel: m.monthLabel,
          year: m.year,
          month: m.month,
          totalHours: parseFloat(m.totalHours.toFixed(1)),
          shiftCount: m.shiftCount,
          activeStaffCount: m.staffSet.size,
          avgHoursPerShift: m.shiftCount > 0 ? parseFloat((m.totalHours / m.shiftCount).toFixed(2)) : 0,
          staffBreakdown: Array.from(m.staffBreakdownMap.entries()).map(([userId, val]) => ({
            userId,
            fullName: val.fullName,
            shifts: val.shifts,
            totalHours: parseFloat(val.totalHours.toFixed(1))
          })).sort((a, b) => b.totalHours - a.totalHours)
        }));

      // 4. Daily Trends (for trend visualizer chart)
      const dayMap = new Map<string, {
        date: string;
        dateLabel: string;
        dayOfWeek: string;
        totalHours: number;
        shiftCount: number;
        staffSet: Set<string>;
      }>();

      // Build range days so chart displays clean time progression
      const curr = new Date(startRange);
      while (curr <= endRange) {
        const dateStr = curr.toISOString().slice(0, 10);
        const dateLabel = curr.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const dayOfWeek = curr.toLocaleDateString("en-US", { weekday: "short" });

        dayMap.set(dateStr, {
          date: dateStr,
          dateLabel,
          dayOfWeek,
          totalHours: 0,
          shiftCount: 0,
          staffSet: new Set()
        });
        curr.setDate(curr.getDate() + 1);
      }

      // Fill in actual logs
      inRangeLogs.forEach(t => {
        const dateStr = new Date(t.arrivalTime).toISOString().slice(0, 10);
        if (dayMap.has(dateStr)) {
          const entry = dayMap.get(dateStr)!;
          const hours = getDurationHours(t);
          entry.totalHours += hours;
          entry.shiftCount += 1;
          entry.staffSet.add(t.userId);
        }
      });

      const dailyTrends = Array.from(dayMap.values()).map(d => ({
        date: d.date,
        dateLabel: d.dateLabel,
        dayOfWeek: d.dayOfWeek,
        totalHours: parseFloat(d.totalHours.toFixed(1)),
        shiftCount: d.shiftCount,
        uniqueStaffCount: d.staffSet.size
      }));

      // 5. Day of Week Breakdown (e.g. Sunday Service vs Midweek)
      const dowNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dowShorts = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dowData = dowNames.map((name, idx) => ({
        day: name,
        shortDay: dowShorts[idx],
        totalHours: 0,
        shiftCount: 0,
        avgHours: 0
      }));

      inRangeLogs.forEach(t => {
        const dowIndex = new Date(t.arrivalTime).getDay();
        const hours = getDurationHours(t);
        dowData[dowIndex].totalHours += hours;
        dowData[dowIndex].shiftCount += 1;
      });

      dowData.forEach(d => {
        d.totalHours = parseFloat(d.totalHours.toFixed(1));
        d.avgHours = d.shiftCount > 0 ? parseFloat((d.totalHours / d.shiftCount).toFixed(2)) : 0;
      });

      // 6. Staff Summaries (Individual Attendance Performance)
      const allStaff = dbInMemory.users.filter(u => u.role === "staff");
      const staffSummariesMap = new Map<string, {
        userId: string;
        fullName: string;
        email: string;
        totalShifts: number;
        totalHours: number;
        lastActive: string | null;
      }>();

      allStaff.forEach(s => {
        staffSummariesMap.set(s.id, {
          userId: s.id,
          fullName: s.fullName,
          email: s.email,
          totalShifts: 0,
          totalHours: 0,
          lastActive: null
        });
      });

      inRangeLogs.forEach(t => {
        let entry = staffSummariesMap.get(t.userId);
        if (!entry) {
          entry = {
            userId: t.userId,
            fullName: t.fullName,
            email: "staff@wrcmedia.org",
            totalShifts: 0,
            totalHours: 0,
            lastActive: null
          };
          staffSummariesMap.set(t.userId, entry);
        }

        const hours = getDurationHours(t);
        entry.totalShifts += 1;
        entry.totalHours += hours;

        if (!entry.lastActive || new Date(t.arrivalTime) > new Date(entry.lastActive)) {
          entry.lastActive = t.arrivalTime;
        }
      });

      const staffSummaries = Array.from(staffSummariesMap.values())
        .map(s => ({
          ...s,
          totalHours: parseFloat(s.totalHours.toFixed(1)),
          avgShiftHours: s.totalShifts > 0 ? parseFloat((s.totalHours / s.totalShifts).toFixed(2)) : 0
        }))
        .sort((a, b) => b.totalHours - a.totalHours);

      res.json({
        report: {
          period: period as any,
          startDate: startRange.toISOString(),
          endDate: endRange.toISOString(),
          overallMetrics: {
            totalHours: parseFloat(totalHours.toFixed(1)),
            totalShifts,
            avgShiftDurationHours,
            activeStaffCount: activeStaffSet.size,
            topContributor
          },
          weeklySummaries,
          monthlySummaries,
          dailyTrends,
          staffSummaries,
          dayOfWeekBreakdown: dowData
        }
      });
    } catch (err) {
      console.error("Admin reports generation error:", err);
      res.status(500).json({ error: "Server error generating attendance reports" });
    }
  });

  // API ROUTE: Add Manual Timesheet Log (Admin Correcting)
  app.post("/api/admin/timesheets/manual", authenticateToken, requireAdmin, (req, res) => {
    try {
      const { userId, arrivalTime, departureTime, notes, departureNotes, arrivalSignature, departureSignature } = req.body;

      if (!userId || !arrivalTime || !departureTime) {
        res.status(400).json({ error: "Staff member, arrival time, and departure time are required." });
        return;
      }

      dbInMemory = initDatabase();

      const staff = dbInMemory.users.find(u => u.id === userId);
      if (!staff) {
        res.status(400).json({ error: "Selected staff member does not exist." });
        return;
      }

      const newLog = {
        id: crypto.randomUUID(),
        userId,
        fullName: staff.fullName,
        arrivalTime,
        departureTime,
        arrivalSignature: arrivalSignature || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='40'><text x='10' y='25' fill='gray' font-family='sans-serif' font-size='12'>Admin Logged</text></svg>",
        departureSignature: departureSignature || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='40'><text x='10' y='25' fill='gray' font-family='sans-serif' font-size='12'>Admin Logged</text></svg>",
        notes: notes || "Manually Logged by Administrator",
        departureNotes: departureNotes || "Manually Completed",
        status: "completed" as const,
        createdAt: new Date().toISOString()
      };

      dbInMemory.timesheets.push(newLog);
      saveDatabase(dbInMemory);

      res.status(201).json({ timesheet: newLog });
    } catch (err) {
      res.status(500).json({ error: "Server error adding manual entry" });
    }
  });

  // API ROUTE: Delete Timesheet Entry
  app.delete("/api/admin/timesheets/:id", authenticateToken, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      dbInMemory = initDatabase();

      const initialLength = dbInMemory.timesheets.length;
      dbInMemory.timesheets = dbInMemory.timesheets.filter(t => t.id !== id);

      if (dbInMemory.timesheets.length === initialLength) {
        res.status(404).json({ error: "Timesheet entry not found" });
        return;
      }

      saveDatabase(dbInMemory);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server error deleting entry" });
    }
  });

  // API ROUTE: Edit/Update Timesheet Entry (Admin adjusting errors)
  app.put("/api/admin/timesheets/:id", authenticateToken, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { arrivalTime, departureTime, notes, departureNotes, status } = req.body;

      dbInMemory = initDatabase();

      const index = dbInMemory.timesheets.findIndex(t => t.id === id);
      if (index === -1) {
        res.status(404).json({ error: "Timesheet record not found." });
        return;
      }

      dbInMemory.timesheets[index] = {
        ...dbInMemory.timesheets[index],
        arrivalTime: arrivalTime || dbInMemory.timesheets[index].arrivalTime,
        departureTime: departureTime !== undefined ? departureTime : dbInMemory.timesheets[index].departureTime,
        notes: notes || dbInMemory.timesheets[index].notes,
        departureNotes: departureNotes !== undefined ? departureNotes : dbInMemory.timesheets[index].departureNotes,
        status: status || dbInMemory.timesheets[index].status
      };

      saveDatabase(dbInMemory);
      res.json({ timesheet: dbInMemory.timesheets[index] });
    } catch (err) {
      res.status(500).json({ error: "Server error updating timesheet entry" });
    }
  });

  // ================= STATIC / DEVELOPMENTS =================

  // Vite middleware for development or serving index.html in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Church Media Timesheet server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
