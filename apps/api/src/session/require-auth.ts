import type { FastifyReply, FastifyRequest } from 'fastify';

export const requireAuth = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
  if (!req.user || !req.session) {
    reply.code(401).send({ error: 'unauthenticated', message: 'sign in first' });
    return reply as unknown as void;
  }
};

/**
 * Helper for routes that want to return 401 without throwing. Typescript flow
 * after this narrows `req.user` and `req.session` to non-null.
 */
export const isAuthed = (
  req: FastifyRequest,
): req is FastifyRequest & {
  user: NonNullable<FastifyRequest['user']>;
  session: NonNullable<FastifyRequest['session']>;
} => Boolean(req.user && req.session);
