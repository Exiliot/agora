import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const runMigrations = async (): Promise<void> => {
  await migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') });
};
