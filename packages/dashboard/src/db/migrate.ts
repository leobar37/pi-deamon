import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { DashboardDatabase } from "./connection.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function runMigrations(db: DashboardDatabase): void {
	const migrationsFolder = join(__dirname, "migrations");
	migrate(db, { migrationsFolder });
}
