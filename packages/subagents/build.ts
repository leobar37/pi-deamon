import { join } from "node:path";

const ENTRY = join(import.meta.dir, "src", "index.ts");
const OUT_DIR = join(import.meta.dir, "dist");
const EXTERNAL = [
	"@earendil-works/pi-agent-core",
	"@earendil-works/pi-ai",
	"@earendil-works/pi-ai/oauth",
	"@earendil-works/pi-coding-agent",
	"@earendil-works/pi-tui",
	"@local/pi-logger",
	"typebox",
	"typebox/compile",
	"typebox/value",
	"zod",
	"zod/v4",
	"zod/v4/core",
];

async function build() {
	const result = await Bun.build({
		entrypoints: [ENTRY],
		outdir: OUT_DIR,
		target: "bun",
		format: "esm",
		external: EXTERNAL,
		naming: "index.js",
	});

	if (!result.success) {
		console.error("Build failed:", result.logs);
		process.exit(1);
	}

	console.log(`Built → ${join(OUT_DIR, "index.js")}`);
}

const isWatch = process.argv.includes("--watch");

if (isWatch) {
	console.log("Watching for changes...");
	await build();
	const watcher = Bun.watch(join(import.meta.dir, "src"), { recursive: true }, async () => {
		console.log("Rebuilding...");
		await build();
	});
	await watcher;
} else {
	await build();
}
