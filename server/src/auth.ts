import { randomBytes, createHmac } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";
import { databaseReady, SessionModel, UserModel } from "./db.js";
declare global {
  namespace Express {
    interface Request {
      assessor?: { id: string; name: string; email: string };
    }
  }
}
export const digest = (value: string) =>
  createHmac("sha256", config.SESSION_SECRET).update(value).digest("hex");
export async function bootstrapAssessor() {
  if (!databaseReady()) return;
  const existing = await UserModel.findOne({
    email: config.ASSESSOR_EMAIL.toLowerCase(),
  });
  if (!existing && config.ASSESSOR_PASSWORD.length >= 12)
    await UserModel.create({
      email: config.ASSESSOR_EMAIL.toLowerCase(),
      name: "Programme assessor",
      passwordHash: await bcrypt.hash(config.ASSESSOR_PASSWORD, 12),
    });
}
export async function sessionUser(req: Request) {
  if (!databaseReady() || !req.cookies?.strive_session) return null;
  const session = await SessionModel.findOne({
    tokenHash: digest(req.cookies.strive_session),
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!session) return null;
  const user = await UserModel.findById(session.userId).lean();
  return user
    ? {
        id: String(user._id),
        name: String(user.name),
        email: String(user.email),
      }
    : null;
}
export async function requireAssessor(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!databaseReady()) {
    res.status(503).json({
      error:
        "Connect MongoDB Atlas to use your live workspace. The example workspace is read-only.",
      code: "DATABASE_NOT_CONFIGURED",
    });
    return;
  }
  const user = await sessionUser(req);
  if (!user) {
    res.status(401).json({
      error: "Please sign in to your assessor workspace.",
      code: "UNAUTHENTICATED",
    });
    return;
  }
  req.assessor = user;
  next();
}
export async function login(req: Request, res: Response) {
  if (!databaseReady()) {
    res.status(503).json({ error: "MongoDB Atlas is not connected." });
    return;
  }
  const { email, password } = req.body;
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.length > 254 ||
    password.length > 256
  ) {
    res.status(400).json({ error: "Enter a valid email and password." });
    return;
  }
  const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
  if (!user || !(await bcrypt.compare(password, String(user.passwordHash)))) {
    res.status(401).json({ error: "Email or password is incorrect." });
    return;
  }
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 8 * 3600000);
  await SessionModel.create({
    tokenHash: digest(token),
    userId: user._id,
    expiresAt,
  });
  res.cookie("strive_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
  res.json({
    user: { id: String(user._id), name: user.name, email: user.email },
  });
}
