import { createHash, randomBytes } from "crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import {
  createApiKey,
  findUserById,
  listApiKeysByUser,
  type User,
} from "@accevum/db";

const hashApiKey = (rawKey: string): string => {
  return createHash("sha256").update(rawKey).digest("hex");
};

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const mintApiKey = async (userId: string, name: string): Promise<string> => {
  const raw = `ack_${randomBytes(24).toString("hex")}`;
  await createApiKey({ userId, name, keyHash: hashApiKey(raw) });
  return raw;
};

export const listUserApiKeys = listApiKeysByUser;

export const requireUser = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    await request.jwtVerify<{ sub: string }>();
  } catch {
    reply.code(401).send({ message: "Unauthorized" });
  }
};

export const getCurrentUser = async (
  request: FastifyRequest
): Promise<User | undefined> => {
  const payload = request.user as { sub: string };
  return findUserById(payload.sub);
};
