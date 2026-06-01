import { describe, expect, it } from "vitest";
import { filterDisallowedSubagentTools, preserveInternalSubagentTools } from "../src/session-factory.js";

describe("session factory tool allowlist", () => {
	it("preserves internal subagent tools when explicit tools are requested", () => {
		const tools = preserveInternalSubagentTools(
			["read", "glob", "grep"],
			["read", "glob", "grep", "subagent_record_context", "subagent_read_context", "subagent_record_result"],
		);

		expect(tools).toEqual([
			"read",
			"glob",
			"grep",
			"subagent_record_context",
			"subagent_read_context",
			"subagent_record_result",
		]);
	});

	it("does not add internal subagent tools that are not registered", () => {
		const tools = preserveInternalSubagentTools(["read"], ["read", "glob"]);

		expect(tools).toEqual(["read"]);
	});

	it("removes lion_tasks from explicit subagent tool allowlists", () => {
		const tools = preserveInternalSubagentTools(
			["read", "lion_tasks"],
			["read", "lion_tasks", "subagent_record_context"],
		);

		expect(tools).toEqual(["read", "subagent_record_context"]);
	});

	it("removes lion_tasks from default active tool lists", () => {
		const tools = filterDisallowedSubagentTools(["read", "lion_tasks", "bash"]);

		expect(tools).toEqual(["read", "bash"]);
	});
});
