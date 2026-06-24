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

function statusLabel(state: LionSubagentUiState): string {
	switch (state.status) {
		case "completed":
			return "Done";
		case "failed":
			return state.summary ? `Error: ${state.summary}` : "Failed";
		case "blocked":
			return state.summary ? `Blocked: ${state.summary}` : "Blocked";
		case "stalled":
			return state.summary ? `Stalled: ${state.summary}` : "Stalled";
		case "running":
			return state.currentTool ? `Using ${state.currentTool}` : (state.summary ?? "Running");
		case "starting":
			return "Starting";
		case "queued":
			return "Queued";
		default:
			return state.status;
	}
}

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
	const minutes = Math.floor(ms / 60_000);
	const seconds = ((ms % 60_000) / 1000).toFixed(0);
	return `${minutes}m ${seconds}s`;
}

function formatMetrics(state: LionSubagentUiState): string[] {
	const parts: string[] = [];
	if (state.turnCount > 0) parts.push(`Q${state.turnCount}`);
	if (state.toolCount > 0) parts.push(`${state.toolCount} tool uses`);
	const elapsed =
		state.status === "completed" || state.status === "failed" || state.status === "blocked"
			? (state.completedAt ?? state.updatedAt) - state.startedAt
			: state.updatedAt - state.startedAt;
	if (elapsed > 0) parts.push(formatDuration(elapsed));
	return parts;
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

function cardBackground(status: LionSubagentUiState["status"], theme: Theme): (text: string) => string {
	switch (status) {
		case "completed":
			return (text) => theme.bg("toolSuccessBg", text);
		case "failed":
		case "stalled":
			return (text) => theme.bg("toolErrorBg", text);
		case "blocked":
			return (text) => theme.bg("customMessageBg", text);
		case "running":
		case "starting":
			return (text) => theme.bg("toolPendingBg", text);
		default:
			return (text) => theme.bg("selectedBg", text);
	}
}

function buildSubagentCardText(state: LionSubagentUiState, theme: Theme, contentWidth: number): string {
	const displayTitle = state.title || `${state.role} ${state.taskId}`;
	const header = `${glyph(state, theme)} ${theme.bold(state.role)} ${theme.fg("dim", "·")} ${theme.bold(displayTitle)}`;
	const metrics = statJoin(theme, formatMetrics(state));
	const status = theme.fg(state.status === "completed" ? "success" : "dim", clip(statusLabel(state), contentWidth));
	const lines = [clip(header, contentWidth)];
	if (metrics) lines.push(metrics);
	lines.push(status);
	return lines.join("\n");
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

	const contentWidth = Math.max(1, width - 2);
	for (const state of ordered.slice(0, 4)) {
		lines.push(...buildSubagentCardText(state, theme, contentWidth).split("\n"));
	}

	const hidden = ordered.length - 4;
	if (hidden > 0) lines.push(clip(theme.fg("dim", `+${hidden} more Lion subagents`), width));
	return lines;
}

function buildWidgetComponent(runtime: LionRuntime): (_tui: unknown, theme: Theme) => Component {
	return (_tui, theme) => {
		const container = new Container();
		const states = [...runtime.subagentUi.values()].sort((left, right) => {
			const statusScore = (state: LionSubagentUiState) =>
				state.status === "running" ? 0 : state.status === "starting" ? 1 : state.status === "queued" ? 2 : 3;
			return statusScore(left) - statusScore(right) || right.updatedAt - left.updatedAt;
		});
		if (states.length === 0) return container;

		const active = states.some(
			(state) => state.status === "running" || state.status === "starting" || state.status === "queued",
		);
		const header = clip(
			`${theme.fg(active ? "accent" : "dim", active ? "●" : "○")} ${theme.fg("toolTitle", theme.bold("Lion subagents"))} ${theme.fg("dim", "· live")}`,
			lineWidth(),
		);
		container.addChild(new Text(header, 1, 0));

		for (const state of states.slice(0, 4)) {
			const text = buildSubagentCardText(state, theme, Math.max(1, lineWidth() - 2));
			container.addChild(new Text(text, 1, 0, cardBackground(state.status, theme)));
		}

		const hidden = states.length - 4;
		if (hidden > 0) {
			container.addChild(new Text(clip(theme.fg("dim", `+${hidden} more Lion subagents`), lineWidth()), 1, 0));
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
