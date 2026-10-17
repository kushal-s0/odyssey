import { randomBytes, createHmac } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";
import { databaseReady, SessionModel, UserModel } from "./db.js";
import { loginSchema, registrationSchema } from "../../shared/input-rules.js";
import type { WorkspaceUser } from "../../shared/types.js";
declare global {
  namespace Express {
    interface Request {
      actor?: WorkspaceUser;
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
      role: "assessor",
      passwordHash: await bcrypt.hash(config.ASSESSOR_PASSWORD, 12),
    });
}
export async function sessionUser(req: Request): Promise<WorkspaceUser | null> {
  if (!databaseReady() || !req.cookies?.strive_session) return null;
  const session = await SessionModel.findOne({
    tokenHash: digest(req.cookies.strive_session),
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!session) return null;
  const user = await UserModel.findById(session.userId).lean();
  return user && (user.role === "assessor" || user.role === "entrepreneur")
    ? {
        id: String(user._id),
        name: String(user.name),
        email: String(user.email),
        role: user.role,
      }
    : null;
}
export async function requireAccount(
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
      error: "Please sign in to your workspace.",
      code: "UNAUTHENTICATED",
    });
    return;
  }
  req.actor = user;
  next();
}
export function requireAssessor(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.actor?.role !== "assessor") {
    res.status(403).json({
      error: "This action requires an assessor account.",
      code: "ASSESSOR_REQUIRED",
    });
    return;
  }
  next();
}
export function submissionScope(user: WorkspaceUser) {
  return user.role === "assessor" ? {} : { ownerId: user.id };
}
async function issueSession(user: any, res: Response) {
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
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
}
export async function register(req: Request, res: Response) {
  if (!databaseReady()) {
    res.status(503).json({ error: "The workspace database is not connected." });
    return;
  }
  const data = registrationSchema.parse(req.body);
  if (data.email === config.ASSESSOR_EMAIL.trim().toLowerCase()) {
    res.status(400).json({
      error:
        "This email is reserved for programme access. Use your provided credentials.",
    });
    return;
  }
  if (await UserModel.exists({ email: data.email })) {
    res
      .status(409)
      .json({ error: "An account already uses this email. Sign in instead." });
    return;
  }
  const user = await UserModel.create({
    name: data.name,
    email: data.email,
    passwordHash: await bcrypt.hash(data.password, 12),
    role: "entrepreneur",
  });
  await issueSession(user, res);
}
export async function login(req: Request, res: Response) {
  if (!databaseReady()) {
    res.status(503).json({ error: "MongoDB Atlas is not connected." });
    return;
  }
  const { email, password } = loginSchema.parse(req.body);
  const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
  if (
    !user ||
    !["assessor", "entrepreneur"].includes(String(user.role)) ||
    !(await bcrypt.compare(password, String(user.passwordHash)))
  ) {
    res.status(401).json({ error: "Email or password is incorrect." });
    return;
  }
  await issueSession(user, res);
}
