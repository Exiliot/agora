/**
 * Per-route rate limit helper applied to credential-handling endpoints
 * (sign-in, password reset, password change, register). Bounds brute-force
 * attempts at 10 per minute per IP + endpoint. Uses @fastify/rate-limit's
 * built-in in-memory store; moves to Redis if we ever scale out.
 */

import type { FastifyInstance, RouteShorthandOptions } from 'fastify';
import rateLimit from '@fastify/rate-limit';

export const registerRateLimitPlugin = async (app: FastifyInstance): Promise<void> => {
  await app.register(rateLimit, {
    // Global defaults are permissive — we opt routes in via `config.rateLimit`.
    global: false,
    max: 100,
    timeWindow: '1 minute',
  });
};

export const authRateLimit: RouteShorthandOptions = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute',
    },
  },
};
