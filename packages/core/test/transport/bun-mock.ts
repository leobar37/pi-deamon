import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

/**
 * Create a mock Bun.serve that uses Node's http module under the hood.
 */
export function createMockBunServe() {
	const servers = new Set<Server>();

	function serve(options: {
		port?: number;
		hostname?: string;
		fetch?: (req: Request) => Response | Promise<Response>;
	}) {
		const server: Server = createServer(async (nodeReq: IncomingMessage, nodeRes: ServerResponse) => {
			if (!options.fetch) {
				nodeRes.statusCode = 500;
				nodeRes.end("No fetch handler");
				return;
			}

			const url = new URL(nodeReq.url ?? "/", `http://${nodeReq.headers.host ?? options.hostname ?? "localhost"}`);
			const headers = new Headers();
			for (const [key, value] of Object.entries(nodeReq.headers)) {
				if (value) {
					if (Array.isArray(value)) {
						for (const v of value) headers.append(key, v);
					} else {
						headers.set(key, value as string);
					}
				}
			}

			const bodyBuffer =
				nodeReq.method === "GET" || nodeReq.method === "HEAD" || nodeReq.method === "OPTIONS"
					? undefined
					: await new Promise<Buffer>((resolve) => {
							const chunks: Buffer[] = [];
							nodeReq.on("data", (chunk: Buffer) => chunks.push(chunk));
							nodeReq.on("end", () => resolve(Buffer.concat(chunks)));
						});
			const body = bodyBuffer ? toArrayBuffer(bodyBuffer) : undefined;

			const req = new Request(url.toString(), {
				method: nodeReq.method,
				headers,
				body,
			});

			try {
				const response = await options.fetch(req);

				nodeRes.statusCode = response.status;
				response.headers.forEach((value, key) => {
					nodeRes.setHeader(key, value);
				});

				if (response.body) {
					const reader = response.body.getReader();
					const pump = async () => {
						try {
							while (true) {
								const { done, value } = await reader.read();
								if (done) break;
								nodeRes.write(value);
							}
						} catch {
							/* stream cancelled */
						} finally {
							nodeRes.end();
						}
					};
					pump();
				} else {
					const text = await response.text();
					nodeRes.end(text);
				}
			} catch {
				nodeRes.statusCode = 500;
				nodeRes.end("Internal Server Error");
			}
		});

		server.listen(options.port ?? 0, options.hostname ?? "0.0.0.0");
		servers.add(server);

		return {
			get port(): number {
				const addr = server.address();
				if (addr && typeof addr === "object") return addr.port;
				return 0;
			},
			stop: (_closeActiveConnections?: boolean) => {
				server.close();
				servers.delete(server);
			},
		};
	}

	return { serve };
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
	const copy = new Uint8Array(buffer.byteLength);
	copy.set(buffer);
	return copy.buffer;
}
