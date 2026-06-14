import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export interface DatabaseOptions {
	path: string;
}

export type DashboardDatabase = BetterSQLite3Database<typeof schema>;

export function createDatabase(options: DatabaseOptions): DashboardDatabase {
	mkdirSync(dirname(options.path), { recursive: true });
	const sqlite = new Database(options.path);
	sqlite.pragma("journal_mode = WAL");
	return drizzle(sqlite, { schema });
}
