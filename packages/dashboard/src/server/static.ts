import { join } from "node:path";

/**
 * Serve a static file with SPA fallback.
 *
 * Tries the exact path, then falls back to `index.html` for client-side routing.
 * Returns a 404 if neither exists.
 */
export async function serveStaticFile(pathname: string, frontendDir: string): Promise<Response> {
	const filePath = pathname === "/" ? "/index.html" : pathname;
	const safePath = filePath.replace(/\.{2,}/g, "").replace(/^\/+/, "");
	const file = Bun.file(join(frontendDir, safePath));

	const exists = await file.exists();
	if (exists) {
		return new Response(file);
	}

	// SPA fallback: serve index.html for unknown paths
	const indexFile = Bun.file(join(frontendDir, "index.html"));
	const indexExists = await indexFile.exists();
	if (indexExists) {
		return new Response(indexFile);
	}

	return new Response("Not Found", { status: 404 });
}
