import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { type Component, Container, Text, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { LionSubagentUiState } from "../job-tracker.js";
import type { LionRuntime } from "../runtime.js";

const LION_SUBAGENT_WIDGET_KEY = "lion-subagents";

interface RenderRequestUi {
	requestRender?: () => void;
}

function glyph(state: LionSubagentUiState, theme: Theme): string {
	if (state.status === "queued") return theme.fg("muted", "◦");
	if (state.status === "starting") return theme.fg("accent", "◌");
	if (state.status === "running") return theme.fg("accent", "●");
	if (state.status === "completed") return theme.fg("success", "✓");
	return theme.fg("error", "✗");
}

function statJoin(theme: Theme, parts: string[]): string {
	return parts
		.filter(Boolean)
		.map((part) => theme.fg("dim", part))
		.join(` ${theme.fg("dim", "·")} `);
}

function lineWidth(): number {
	return process.stdout.columns || 120;
}

function clip(line: string, width: number): string {
	if (visibleWidth(line) <= width) return line;
	return truncateToWidth(line, width);
}

function stateStats(state: LionSubagentUiState, theme: Theme): string {
	const parts = [state.definition ?? ""];
	return statJoin(theme, parts);
}

export function buildLionSubagentWidgetLines(
	states: Iterable<LionSubagentUiState>,
	theme: Theme,
	width = lineWidth(),
): string[] {
	const ordered = [...states].sort((left, right) => {
		const statusScore = (state: LionSubagentUiState) =>
			state.status === "running" ? 0 : state.status === "starting" ? 1 : state.status === "queued" ? 2 : 3;
		return statusScore(left) - statusScore(right) || right.updatedAt - left.updatedAt;
	});
	if (ordered.length === 0) return [];

	const active = ordered.some(
		(state) => state.status === "running" || state.status === "starting" || state.status === "queued",
	);
	const lines = [
		clip(
			`${theme.fg(active ? "accent" : "dim", active ? "●" : "○")} ${theme.fg("toolTitle", theme.bold("Lion subagents"))} ${theme.fg("dim", "· live")}`,
			width,
		),
	];

	for (const state of ordered.slice(0, 4)) {
		const stats = stateStats(state, theme);
		const displayTitle = state.title || `${state.role} ${state.taskId}`;
		lines.push(
			clip(
				`${glyph(state, theme)} ${theme.bold(displayTitle)} ${theme.fg("dim", "·")} ${theme.fg("dim", state.status)}${stats ? ` ${theme.fg("dim", "·")} ${stats}` : ""}`,
				width,
			),
		);
	}

	const hidden = ordered.length - 4;
	if (hidden > 0) lines.push(clip(theme.fg("dim", `+${hidden} more Lion subagents`), width));
	return lines;
}

function buildWidgetComponent(runtime: LionRuntime): (_tui: unknown, theme: Theme) => Component {
	return (_tui, theme) => {
		const container = new Container();
		for (const line of buildLionSubagentWidgetLines(runtime.subagentUi.values(), theme)) {
			container.addChild(new Text(line, 1, 0));
		}
		return container;
	};
}

export function stopLionSubagentWidget(runtime: LionRuntime): void {
	if (runtime.widgetTimer) {
		clearInterval(runtime.widgetTimer);
		runtime.widgetTimer = null;
	}
	if (runtime.lastUiContext?.hasUI) runtime.lastUiContext.ui.setWidget(LION_SUBAGENT_WIDGET_KEY, undefined);
}

export function renderLionSubagentWidget(runtime: LionRuntime, ctx?: ExtensionContext): void {
	const uiContext = ctx?.hasUI ? ctx : runtime.lastUiContext;
	if (!uiContext?.hasUI) return;
	runtime.lastUiContext = uiContext;
	runtime.cleanupSubagentUi();
	if (runtime.subagentUi.size === 0) {
		stopLionSubagentWidget(runtime);
		return;
	}

	uiContext.ui.setWidget(LION_SUBAGENT_WIDGET_KEY, buildWidgetComponent(runtime));
	requestRender(uiContext);
}

function requestRender(ctx: ExtensionContext): void {
	(ctx.ui as RenderRequestUi).requestRender?.();
}
