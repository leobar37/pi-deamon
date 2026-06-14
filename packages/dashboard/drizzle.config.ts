import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./src/db/migrations",
	dialect: "sqlite",
	dbCredentials: {
		url: process.env.DASHBOARD_DATABASE_URL ?? ".pi/dashboard.sqlite",
	},
});
