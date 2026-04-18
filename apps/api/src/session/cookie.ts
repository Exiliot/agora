/**
 * Session cookie helpers. Uses @fastify/cookie for HttpOnly, SameSite=Lax,
 * signed cookies. In development (http), `secure=false`; production sets it
 * behind HTTPS.
 */

import type { FastifyReply } from 'fastify';
import { COOKIE_NAME } from './plugin.js';
import { config } from '../config.js';

const fourteenDaysSeconds = 14 * 24 * 60 * 60;

export const setSessionCookie = (reply: FastifyReply, token: string): void => {
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    path: '/',
    maxAge: fourteenDaysSeconds,
  });
};

export const clearSessionCookie = (reply: FastifyReply): void => {
  reply.clearCookie(COOKIE_NAME, { path: '/' });
};
