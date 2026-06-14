import { createServer as createNodeServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { RPCHandler } from "@orpc/server/fetch";

export type FetchHandler = (request: Request) => Response | Promise<Response>;

export interface HttpServer {
	port: number;
	stop(force?: boolean): void;
}

async function responseToBuffer(response: Response): Promise<Buffer> {
	const arrayBuffer = await response.arrayBuffer();
	return Buffer.from(arrayBuffer);
}

function nodeRequestToFetch(req: IncomingMessage, hostname: string, port: number): Request {
	const protocol = "http";
	const url = `${protocol}://${hostname}:${port}${req.url ?? "/"}`;
	const headers = new Headers();
	for (const [key, value] of Object.entries(req.headers)) {
		if (value === undefined) continue;
		if (Array.isArray(value)) {
			for (const item of value) {
				headers.append(key, item);
			}
		} else {
			headers.set(key, value);
		}
	}

	const method = req.method ?? "GET";
	if (method === "GET" || method === "HEAD") {
		return new Request(url, { method, headers });
	}

	return new Request(url, {
		method,
		headers,
		// @ts-expect-error duplex is required by Node's RequestInit but missing in DOM types
		duplex: "half",
		body: new ReadableStream({
			start(controller) {
				req.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
				req.on("end", () => controller.close());
				req.on("error", (err) => controller.error(err));
			},
		}) as BodyInit,
	});
}

async function sendFetchResponse(res: ServerResponse, response: Response): Promise<void> {
	res.statusCode = response.status;
	res.statusMessage = response.statusText;
	response.headers.forEach((value, key) => {
		res.setHeader(key, value);
	});

	if (response.body) {
		const reader = response.body.getReader();
		try {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				res.write(Buffer.from(value));
			}
			res.end();
		} catch (error) {
			res.destroy(error instanceof Error ? error : undefined);
		}
		return;
	}

	const body = await responseToBuffer(response);
	res.end(body);
}

function startNodeServer(handler: FetchHandler, hostname: string, port: number): Promise<HttpServer> {
	const server = createNodeServer(async (req, res) => {
		try {
			const request = nodeRequestToFetch(req, hostname, port);
			const response = await handler(request);
			await sendFetchResponse(res, response);
		} catch (error) {
			console.error("[dashboard] HTTP handler error:", error);
			if (!res.headersSent) {
				res.statusCode = 500;
				res.end("Internal Server Error");
			}
		}
	});

	return new Promise((resolve, reject) => {
		server.listen(port, hostname, () => {
			resolve({
				port,
				stop: (force = true) => {
					server.close(force ? () => undefined : undefined);
					if (force) {
						server.closeAllConnections?.();
					}
				},
			});
		});
		server.on("error", reject);
	});
}

interface BunServer {
	port: number;
	stop(force?: boolean): void;
}

interface BunRuntime {
	serve(options: { hostname: string; port: number; fetch: FetchHandler }): BunServer;
}

function getBunRuntime(): BunRuntime | undefined {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (globalThis as { Bun?: BunRuntime }).Bun;
}

function startBunServer(handler: FetchHandler, hostname: string, port: number): HttpServer {
	const bun = getBunRuntime();
	if (!bun) {
		throw new Error("Bun is not available");
	}
	const server = bun.serve({
		hostname,
		port,
		fetch: handler,
	});
	return {
		port: server.port,
		stop: (force = true) => server.stop(force),
	};
}

export async function startHttpServer(handler: FetchHandler, hostname: string, port: number): Promise<HttpServer> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	if (typeof (globalThis as { Bun?: unknown }).Bun !== "undefined") {
		return startBunServer(handler, hostname, port);
	}
	return startNodeServer(handler, hostname, port);
}

export function createFetchHandler<Context extends Record<PropertyKey, unknown>>(
	rpcHandler: RPCHandler<Context>,
	prefix: `/${string}`,
	context: Context,
	staticHandler: (pathname: string) => Response | Promise<Response>,
	eventHandler?: (request: Request) => Response | undefined,
): FetchHandler {
	return async (request: Request) => {
		const url = new URL(request.url);

		const eventResponse = eventHandler?.(request);
		if (eventResponse) {
			return eventResponse;
		}

		if (url.pathname.startsWith(prefix)) {
			const { matched, response } = await rpcHandler.handle(request, {
				prefix,
				context,
			});
			if (matched) {
				return response;
			}
		}

		return staticHandler(url.pathname);
	};
}
