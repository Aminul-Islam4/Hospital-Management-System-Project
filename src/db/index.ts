import { drizzle } from 'drizzle-orm/netlify-db';
import * as schema from './schema.ts';

// Netlify Database (managed Postgres). The connection is configured
// automatically by the Netlify platform — no connection string needed.
export const db = drizzle({ schema });
