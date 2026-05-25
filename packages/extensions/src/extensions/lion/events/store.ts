import { existsSync } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { LionEvent } from "../types.js";

export class LionEventStore {
	private pending: Promise<void> = Promise.resolve();

	constructor(private readonly cwd: string) {}

	async save(event: LionEvent): Promise<void> {
		const promise = this.pending.then(async () => {
			const dir = join(this.cwd, ".lion", "runs");
			if (!existsSync(dir)) await mkdir(dir, { recursive: true });
			await appendFile(join(dir, `${event.runId}.events.jsonl`), `${JSON.stringify(event)}\n`, "utf-8");
		});
		this.pending = promise.catch(() => {});
		return promise;
	}
}
