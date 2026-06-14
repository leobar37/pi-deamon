import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

/**
 * Copies the drizzle migration files alongside the bundled main.cjs so that
 * `runMigrations` finds `meta/_journal.json` next to the compiled daemon code.
 */
function copyMigrationsPlugin(srcDir: string, outDir: string): Plugin {
	return {
		name: "copy-drizzle-migrations",
		closeBundle() {
			const from = resolve(srcDir, "migrations");
			const to = resolve(outDir, "migrations");
			if (!existsSync(from)) {
				throw new Error(`drizzle migrations folder not found at ${from}`);
			}
			mkdirSync(outDir, { recursive: true });
			cpSync(from, to, { recursive: true });
		},
	};
}

export default defineConfig({
	plugins: [
		copyMigrationsPlugin(
			resolve(__dirname, "..", "src", "db"),
			resolve(__dirname, "dist"),
		),
	],
	build: {
		lib: {
			entry: {
				main: resolve(__dirname, "main.ts"),
				preload: resolve(__dirname, "preload.ts"),
			},
			formats: ["cjs"],
			fileName: (_format, entryName) => `${entryName}.cjs`,
		},
		outDir: resolve(__dirname, "dist"),
		emptyOutDir: true,
		minify: false,
		rollupOptions: {
			external: [
				"electron",
				/^node:/,
				"better-sqlite3",
			],
			output: {
				inlineDynamicImports: false,
			},
		},
	},
});
