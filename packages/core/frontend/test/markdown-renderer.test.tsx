import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "../src/components/blocks/MarkdownRenderer";

describe("MarkdownRenderer", () => {
	it("renders markdown tables with dashboard table styling", () => {
		const html = renderToString(
			<MarkdownRenderer
				content={[
					"| Source | Destination |",
					"| --- | --- |",
					"| `apps/elena/app/.env` | `apps/elena/app/.env.local` |",
				].join("\n")}
			/>,
		);

		expect(html).toContain("rounded-md border border-border-subtle");
		expect(html).toContain("divide-y divide-border-subtle");
		expect(html).toContain("max-w-[28rem]");
		expect(html).toContain("apps/elena/app/.env");
		expect(html).not.toContain("download");
		expect(html).not.toContain("fullscreen");
	});
});
