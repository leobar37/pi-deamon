import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DashboardSessionLogStore } from "../src/api/session-log-store.js";

describe("DashboardSessionLogStore", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "dashboard-log-store-test-"));
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	it("skips malformed and invalid JSONL records while reading session logs", async () => {
		const logDir = join(tmpDir, ".pi", "dashboard", "logs");
		mkdirSync(logDir, { recursive: true });
		writeFileSync(
			join(logDir, "session-1.jsonl"),
			[
				"{malformed",
				JSON.stringify({ timestamp: 1, sessionId: "session-1", type: "missing-level", source: "test", data: {} }),
				JSON.stringify({
					timestamp: 2,
					sessionId: "session-1",
					threadId: "main:session-1",
					type: "model.select.success",
					source: "dashboard",
					level: "info",
					data: { provider: "kimi-coding" },
				}),
			].join("\n"),
			"utf-8",
		);

		const store = new DashboardSessionLogStore(tmpDir);
		const entries = await store.query({ sessionId: "session-1" });

		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			sessionId: "session-1",
			threadId: "main:session-1",
			type: "model.select.success",
			level: "info",
		});
	});
});
