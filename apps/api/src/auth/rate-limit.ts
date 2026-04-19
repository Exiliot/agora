/**
 * Per-route rate limit helper applied to credential-handling endpoints
 * (sign-in, password reset, password change, register). Bounds brute-force
 * attempts at 10 per minute per key + endpoint. Uses @fastify/rate-limit's
 * built-in in-memory store; moves to Redis if we ever scale out.
 *
 * Keying strategy (ADR-0008 candidate): the default IP key leaves
 * credential-stuffing from proxy pools largely unconstrained. For
 * `sign-in` and `password-reset/request` we compose `ip + email` so a
 * single account cannot be attacked from many IPs; for `password-change`
 * we key on the session id so one stolen cookie cannot burn many guesses.
 * Keys fall back to the IP when the body has not yet been parsed.
 */

import type { FastifyInstance, FastifyRequest, RouteShorthandOptions } from 'fastify';
import rateLimit from '@fastify/rate-limit';

export const registerRateLimitPlugin = async (app: FastifyInstance): Promise<void> => {
  await app.register(rateLimit, {
    // Global defaults are permissive — we opt routes in via `config.rateLimit`.
    global: false,
    max: 100,
    timeWindow: '1 minute',
  });
};

const readEmail = (req: FastifyRequest): string | null => {
  const body = req.body as { email?: unknown } | null | undefined;
  if (!body || typeof body.email !== 'string') return null;
  const trimmed = body.email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
};

export const authRateLimit: RouteShorthandOptions = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute',
    },
  },
};

// For sign-in and password-reset/request: compose the key with the
// submitted email so an attacker with N proxies still gets only 10
// attempts per minute against a given account. Falls back to IP if the
// email is missing (keeps early-validation paths rate-limited too).
export const authEmailRateLimit: RouteShorthandOptions = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute',
      keyGenerator: (req: FastifyRequest): string => {
        const email = readEmail(req);
        return email ? `${req.ip}|${email}` : req.ip;
      },
    },
  },
};

// For password-change: key on the authenticated session id so a stolen
// cookie cannot be used to burn current-password guesses from many IPs.
// Falls back to IP if the session has not been resolved yet.
export const authSessionRateLimit: RouteShorthandOptions = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute',
      keyGenerator: (req: FastifyRequest): string => {
        const sessionId = req.session?.id;
        return sessionId ? `session:${sessionId}` : req.ip;
      },
    },
  },
};
