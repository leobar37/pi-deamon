import { cpSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const ENTRY = join(import.meta.dir, "src", "index.ts");
const OUT_DIR = join(import.meta.dir, "dist");
const EXTENSIONS_OUT_DIR = join(OUT_DIR, "extensions");
const FRONTEND_DIR = join(import.meta.dir, "frontend");
const SKILLS_DIR = join(import.meta.dir, "skills");
const DIST_SKILLS_DIR = join(OUT_DIR, "skills");
const EXTENSIONS_DIR = join(import.meta.dir, "src", "extensions");
const EXTERNAL_LIB = [
	"@earendil-works/pi-agent-core",
	"@earendil-works/pi-ai",
	"@earendil-works/pi-ai/oauth",
	"@earendil-works/pi-coding-agent",
	"@earendil-works/pi-tui",
	"typebox",
	"typebox/compile",
	"typebox/value",
	"zod",
	"zod/v4",
	"zod/v4/core",
];
const EXTERNAL_EXT = [
	"@earendil-works/pi-agent-core",
	"@earendil-works/pi-ai",
	"@earendil-works/pi-ai/oauth",
	"@earendil-works/pi-tui",
	"@earendil-works/pi-coding-agent",
	"@mariozechner/pi-agent-core",
	"@mariozechner/pi-ai",
	"@mariozechner/pi-ai/oauth",
	"@mariozechner/pi-tui",
	"@mariozechner/pi-coding-agent",
	"@local/pi-dashboard",
	"typebox",
	"typebox/compile",
	"typebox/value",
	"@sinclair/typebox",
	"@sinclair/typebox/compile",
	"@sinclair/typebox/value",
];

async function buildFrontend() {
	const proc = Bun.spawn(["bun", "run", "build"], {
		cwd: FRONTEND_DIR,
		stdout: "inherit",
		stderr: "inherit",
	});
	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		console.error(`Frontend build failed with exit code ${exitCode}`);
		process.exit(exitCode);
	}
}

async function buildLib() {
	const result = await Bun.build({
		entrypoints: [ENTRY],
		outdir: OUT_DIR,
		target: "bun",
		format: "esm",
		external: EXTERNAL_LIB,
		naming: "index.js",
	});

	if (!result.success) {
		console.error("Lib build failed:", result.logs);
		process.exit(1);
	}
	console.log(`Built lib → ${join(OUT_DIR, "index.js")}`);
}

function discoverExtensionEntrypoints(dir: string): Array<{ entrypoint: string; name: string }> {
	const entries: Array<{ entrypoint: string; name: string }> = [];
	if (!existsSync(dir)) return entries;

	for (const name of readdirSync(dir)) {
		const extDir = join(dir, name);
		if (!statSync(extDir).isDirectory()) continue;
		const indexFile = join(extDir, "index.ts");
		if (existsSync(indexFile)) {
			entries.push({ entrypoint: indexFile, name });
		}
	}
	return entries;
}

async function buildExtensions() {
	const extensions = discoverExtensionEntrypoints(EXTENSIONS_DIR);
	if (extensions.length === 0) {
		console.log(`No extension entrypoints found in ${EXTENSIONS_DIR}`);
		return;
	}

	let built = 0;
	for (const { entrypoint, name } of extensions) {
		const result = await Bun.build({
			entrypoints: [entrypoint],
			outdir: EXTENSIONS_OUT_DIR,
			target: "bun",
			format: "esm",
			sourcemap: "inline",
			external: EXTERNAL_EXT,
			naming: {
				entry: `${name}.js`,
				chunk: `${name}-[name].[ext]`,
			},
		});

		if (!result.success) {
			for (const log of result.logs) {
				console.error(`[${name}]`, log);
			}
			process.exit(1);
		}
		built++;
	}
	console.log(`Built ${built} extensions → ${EXTENSIONS_OUT_DIR}`);
}

async function build() {
	await buildFrontend();
	await Promise.all([buildLib(), buildExtensions()]);

	if (existsSync(SKILLS_DIR)) {
		rmSync(DIST_SKILLS_DIR, { recursive: true, force: true });
		cpSync(SKILLS_DIR, DIST_SKILLS_DIR, { recursive: true });
	}
}

const isWatch = process.argv.includes("--watch");

if (isWatch) {
	console.log("Watching for changes...");
	await build();
	const srcWatcher = Bun.watch(join(import.meta.dir, "src"), { recursive: true }, async () => {
		console.log("Rebuilding...");
		await build();
	});
	const skillsWatcher = existsSync(SKILLS_DIR)
		? Bun.watch(SKILLS_DIR, { recursive: true }, async () => {
				console.log("Rebuilding...");
				await build();
			})
		: undefined;
	await Promise.all([srcWatcher, skillsWatcher].filter((watcher) => watcher !== undefined));
} else {
	await build();
}
