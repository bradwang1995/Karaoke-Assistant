import type { AdminSessionStatus } from "../src/types/admin";
import { apiError, jsonResponse } from "./json";
import { checkRateLimit } from "./rateLimit";

const ADMIN_SESSION_COOKIE = "ktv_admin_session";
const ADMIN_SESSION_VERSION = 1;
const ADMIN_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
const DEFAULT_ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE = 5;

interface AdminSessionPayload {
  version: number;
  expiresAt: number;
}

interface AdminAuthEnv {
  SEARCH_CACHE?: {
    get<T>(key: string, options: { type: "json" }): Promise<T | null>;
    put(key: string, value: string, options?: KVNamespacePutOptions): Promise<void>;
  };
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
  ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE?: string;
}

export async function createAdminSession(request: Request, env: AdminAuthEnv) {
  if (!hasAdminConfiguration(env)) {
    return adminError(503, "ADMIN_NOT_CONFIGURED", "管理员登录尚未配置。");
  }

  const rateLimit = await checkRateLimit({
    namespace: env.SEARCH_CACHE,
    scope: "admin-login",
    identity: clientIdentity(request),
    limit: getAdminLoginRateLimitPerMinute(env),
  });

  if (!rateLimit.allowed) {
    return jsonResponse(
      {
        error: {
          code: "ADMIN_LOGIN_RATE_LIMITED",
          message: "登录尝试过于频繁，请稍后再试。",
        },
      },
      {
        status: 429,
        headers: { "retry-after": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const password = readPassword(body);

  if (!password || !(await verifyPassword(password, env.ADMIN_PASSWORD!, env.ADMIN_SESSION_SECRET!))) {
    return adminError(401, "ADMIN_LOGIN_FAILED", "管理员密码不正确。");
  }

  const now = Date.now();
  const expiresAt = now + ADMIN_SESSION_MAX_AGE_SECONDS * 1000;
  const token = await createSessionToken(
    {
      version: ADMIN_SESSION_VERSION,
      expiresAt,
    },
    env.ADMIN_SESSION_SECRET!,
  );

  return jsonResponse(
    {
      authenticated: true,
      expiresAt: new Date(expiresAt).toISOString(),
    } satisfies AdminSessionStatus,
    {
      headers: {
        "cache-control": "no-store",
        "set-cookie": serializeSessionCookie(token, ADMIN_SESSION_MAX_AGE_SECONDS),
      },
    },
  );
}

export async function readAdminSession(request: Request, env: AdminAuthEnv) {
  const session = await getAdminSession(request, env);

  if (!session) {
    return adminError(401, "ADMIN_UNAUTHORIZED", "需要管理员登录。");
  }

  return jsonResponse(
    {
      authenticated: true,
      expiresAt: new Date(session.expiresAt).toISOString(),
    } satisfies AdminSessionStatus,
    { headers: { "cache-control": "no-store" } },
  );
}

export function clearAdminSession() {
  return jsonResponse(
    { authenticated: false },
    {
      headers: {
        "cache-control": "no-store",
        "set-cookie": serializeSessionCookie("", 0),
      },
    },
  );
}

export async function requireAdmin(request: Request, env: AdminAuthEnv) {
  return (await getAdminSession(request, env)) !== null;
}

export function isSameOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

async function getAdminSession(request: Request, env: AdminAuthEnv) {
  if (!hasAdminConfiguration(env)) {
    return null;
  }

  const token = readCookie(request.headers.get("cookie"), ADMIN_SESSION_COOKIE);

  if (!token) {
    return null;
  }

  return verifySessionToken(token, env.ADMIN_SESSION_SECRET!);
}

function hasAdminConfiguration(env: AdminAuthEnv) {
  return Boolean(env.ADMIN_PASSWORD && env.ADMIN_SESSION_SECRET);
}

function readPassword(value: unknown) {
  if (typeof value !== "object" || value === null || !("password" in value)) {
    return null;
  }

  const password = (value as { password?: unknown }).password;
  return typeof password === "string" && password.length <= 256 ? password : null;
}

async function verifyPassword(candidate: string, expected: string, secret: string) {
  const key = await importHmacKey(secret);
  const expectedSignature = await crypto.subtle.sign("HMAC", key, encode(expected));
  return crypto.subtle.verify("HMAC", key, expectedSignature, encode(candidate));
}

async function createSessionToken(payload: AdminSessionPayload, secret: string) {
  const encodedPayload = toBase64Url(encode(JSON.stringify(payload)));
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encode(encodedPayload));
  return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
}

async function verifySessionToken(token: string, secret: string) {
  const [encodedPayload, encodedSignature, extra] = token.split(".");

  if (!encodedPayload || !encodedSignature || extra) {
    return null;
  }

  try {
    const signature = fromBase64Url(encodedSignature);
    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify("HMAC", key, signature, encode(encodedPayload));

    if (!valid) {
      return null;
    }

    const payload = JSON.parse(decode(fromBase64Url(encodedPayload))) as Partial<AdminSessionPayload>;

    if (
      payload.version !== ADMIN_SESSION_VERSION ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }

    return payload as AdminSessionPayload;
  } catch {
    return null;
  }
}

function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function serializeSessionCookie(value: string, maxAge: number) {
  return [
    `${ADMIN_SESSION_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
  ].join("; ");
}

function readCookie(header: string | null, name: string) {
  for (const part of (header ?? "").split(";")) {
    const [key, ...valueParts] = part.trim().split("=");

    if (key === name) {
      return valueParts.join("=");
    }
  }

  return null;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encode(value: string) {
  return new TextEncoder().encode(value);
}

function decode(value: Uint8Array) {
  return new TextDecoder().decode(value);
}

function getAdminLoginRateLimitPerMinute(env: AdminAuthEnv) {
  const value = Number(env.ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE);
  return Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : DEFAULT_ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE;
}

function clientIdentity(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anonymous"
  );
}

function adminError(status: number, code: string, message: string) {
  return apiError(status, code, message, {
    headers: { "cache-control": "no-store" },
  });
}
