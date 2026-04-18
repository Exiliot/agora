/**
 * Route module wiring. Feature modules add themselves via `addRouteModule` in
 * their own `routes.ts`; this file imports each feature module's entry so it
 * runs before `registerAllRouteModules` is called by the server.
 *
 * Feature agents: add a line `import '../<feature>/routes.js';` here when your
 * feature module is in place.
 */

export { registerAllRouteModules } from './registry.js';

// Feature imports — one per feature module. Uncomment / add as features land.
// import '../auth/routes.js';
// import '../rooms/routes.js';
// import '../messages/routes.js';
// import '../friends/routes.js';
// import '../attachments/routes.js';
// import '../notifications/routes.js';
// import '../sessions/routes.js';
