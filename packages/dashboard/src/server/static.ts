import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

/**
 * Serve a static file with SPA fallback.
 *
 * Tries the exact path, then falls back to `index.html` for client-side routing.
 * Returns a 404 if neither exists. Uses Node `fs` so the function works under both
 * the Bun runtime (dev) and the Node runtime that ships inside Electron main.
 */

const MIME_BY_EXT: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".map": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".txt": "text/plain; charset=utf-8",
};

function contentTypeFor(filePath: string): string {
	return MIME_BY_EXT[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

async function readAsResponse(absolutePath: string): Promise<Response | null> {
	try {
		const body = await readFile(absolutePath);
		return new Response(body, {
			status: 200,
			headers: { "content-type": contentTypeFor(absolutePath) },
		});
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			return null;
		}
		throw err;
	}
}

export async function serveStaticFile(pathname: string, frontendDir: string): Promise<Response> {
	const filePath = pathname === "/" ? "/index.html" : pathname;
	const safePath = filePath.replace(/\.{2,}/g, "").replace(/^\/+/, "");
	const resolved = join(frontendDir, safePath);

	const found = await readAsResponse(resolved);
	if (found) {
		return found;
	}

	// SPA fallback: serve index.html for unknown paths
	const indexResponse = await readAsResponse(join(frontendDir, "index.html"));
	if (indexResponse) {
		return indexResponse;
	}

	return new Response("Not Found", { status: 404 });
}
