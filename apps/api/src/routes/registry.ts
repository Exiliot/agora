/**
 * Feature route registry. Each feature module exports a `RouteModule` with
 * `register(app)` and optional WS handler registration. This keeps feature
 * modules decoupled from `server.ts` — agents building features never edit
 * server.ts directly.
 */

import type { FastifyInstance } from 'fastify';

export interface RouteModule {
  readonly name: string;
  register(app: FastifyInstance): Promise<void> | void;
}

const modules: RouteModule[] = [];

export const addRouteModule = (mod: RouteModule): void => {
  modules.push(mod);
};

export const registerAllRouteModules = async (app: FastifyInstance): Promise<void> => {
  for (const mod of modules) {
    app.log.debug({ module: mod.name }, 'registering route module');
    await mod.register(app);
  }
};
