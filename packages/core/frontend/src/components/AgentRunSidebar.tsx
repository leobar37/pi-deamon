import { useLionChecklist } from "../hooks/use-lion-checklist.ts";
import { useLionState } from "../hooks/use-lion-state.ts";
import type { LionChecklistSnapshot, SubAgentInstanceState, SubAgentRunRecord } from "../types.ts";
import { useSubAgentStore } from "../store/use-subagent-store.ts";
import { MarkdownRenderer } from "./blocks/MarkdownRenderer";
import { ChecklistProgressBlock } from "./ChecklistProgressBlock.tsx";
import { isLionUiActive } from "./LionModeBadge.tsx";
import { TaskSidebarSection } from "./TaskSidebarSection.tsx";
import { X } from "lucide-react";

interface AgentRunSidebarProps {
	agent?: SubAgentInstanceState;
	run?: SubAgentRunRecord;
	isLoading?: boolean;
	isOpen?: boolean;
	presentation?: "sidebar" | "drawer";
	onClose?: () => void;
}

function formatTime(value?: number | null): string {
	if (!value) return "n/a";
	return new Date(value).toLocaleString();
}

function CopyButton({ text, label }: { text: string; label: string }) {
	return (
		<button
			type="button"
			onClick={() => copyText(text)}
			disabled={!text.trim()}
			className="rounded border border-border-subtle px-2 py-1 text-xs text-text-secondary transition hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
		>
			{label}
		</button>
	);
}

async function copyText(text: string): Promise<void> {
	if (!text.trim()) return;
	try {
		await navigator.clipboard.writeText(text);
		return;
	} catch {
		const textarea = document.createElement("textarea");
		textarea.value = text;
		textarea.setAttribute("readonly", "");
		textarea.style.position = "fixed";
		textarea.style.left = "-9999px";
		document.body.appendChild(textarea);
		textarea.select();
		document.execCommand("copy");
		document.body.removeChild(textarea);
	}
}

export function AgentRunSidebar({
	agent,
	run,
	isLoading,
	isOpen = true,
	presentation = "sidebar",
	onClose,
}: AgentRunSidebarProps) {
	const { data: lionState } = useLionState();
	const activePlanReference = lionState?.activePlanPath ?? undefined;
	const agents = useSubAgentStore((state) => state.agents);
	const input = run?.prompt ?? "";
	const systemPrompt = run?.systemPrompt ?? "";
	const output = run?.summary ?? run?.error ?? "";
	const isMain = agent?.kind === "main";
	const todoMockMode = isTodoMockMode();
	const isLionActive = !todoMockMode && isLionUiActive(lionState);
	const showStatus = !isMain;
	const isPlanStrategy = lionState?.strategy === "plan";
	const { data: planChecklist } = useLionChecklist("plan", activePlanReference, {
		enabled: isMain && isLionActive && isPlanStrategy && Boolean(activePlanReference),
		refetchInterval: 2000,
	});
	const runProgress = isMain && isLionActive && isPlanStrategy && agent && lionState?.phase === "building" ? getRunProgress(agents, agent.instanceId) : null;

	const content = (
		<AgentRunSidebarContent
			agent={agent}
			run={run}
			isLoading={isLoading}
			isMain={isMain}
			showStatus={showStatus}
			planChecklist={planChecklist}
			runProgress={runProgress}
			compactTasks={todoMockMode}
			input={input}
			systemPrompt={systemPrompt}
			output={output}
			showClose={presentation === "drawer"}
			onClose={onClose}
		/>
	);

	if (presentation === "drawer") {
		return (
			<div className={`fixed inset-0 z-50 ${isOpen ? "block" : "hidden"}`}>
				<button
					type="button"
					className="absolute inset-0 bg-black/45"
					aria-label="Close session details"
					onClick={onClose}
				/>
				<aside
					className={`absolute right-0 top-0 flex h-full flex-col border-l border-border-subtle bg-bg-elevated shadow-2xl ${
						todoMockMode ? "w-[min(280px,calc(100vw-0.5rem))]" : "w-[340px] max-w-[calc(100vw-1rem)]"
					} min-h-0`}
				>
					{content}
				</aside>
			</div>
		);
	}

	return (
		<>
			<div className={`fixed inset-0 z-50 lg:hidden ${isOpen ? "block" : "hidden"}`}>
				<button
					type="button"
					className="absolute inset-0 bg-black/45"
					aria-label="Close session details"
					onClick={onClose}
				/>
				<aside
					className={`absolute right-0 top-0 flex h-full flex-col border-l border-border-subtle bg-bg-elevated shadow-2xl ${
						todoMockMode ? "w-[min(280px,calc(100vw-0.5rem))]" : "w-[min(340px,calc(100vw-1rem))]"
					} min-h-0`}
				>
					{content}
				</aside>
			</div>
			<aside
				className={`hidden min-h-0 shrink-0 flex-col overflow-hidden border-l bg-bg-elevated transition-all duration-300 ease-in-out lg:flex ${
					isOpen ? `${todoMockMode ? "w-[280px]" : "w-[340px]"} border-border-subtle` : "w-0 border-transparent"
				}`}
			>
				{content}
			</aside>
		</>
	);
}

function AgentRunSidebarContent({
	agent,
	run,
	isLoading,
	isMain,
	showStatus,
	planChecklist,
	runProgress,
	compactTasks,
	input,
	systemPrompt,
	output,
	showClose,
	onClose,
}: {
	agent?: SubAgentInstanceState;
	run?: SubAgentRunRecord;
	isLoading?: boolean;
	isMain: boolean;
	showStatus: boolean;
	planChecklist?: LionChecklistSnapshot;
	runProgress: RunProgress | null;
	compactTasks: boolean;
	input: string;
	systemPrompt: string;
	output: string;
	showClose: boolean;
	onClose?: () => void;
}) {
	return (
		<div className={`relative flex min-w-0 flex-1 flex-col ${compactTasks ? "lg:min-w-[280px]" : "lg:min-w-[340px]"}`}>
			{compactTasks ? (
				showClose ? (
					<button
						type="button"
						onClick={onClose}
						className="absolute right-2 top-2 z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-secondary transition hover:border-border-hover hover:bg-bg-hover hover:text-text-primary"
						aria-label="Close session details"
					>
						<X size={13} aria-hidden="true" />
					</button>
				) : null
			) : (
				<div className="border-b border-border-subtle px-4 py-3">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<div className="text-xs uppercase tracking-wide text-text-tertiary">{isMain ? "Session" : "Run"}</div>
						<div className="mt-1 truncate text-sm font-medium text-text-primary">{run?.description ?? agent?.description ?? agent?.definitionName ?? "Subagent"}</div>
					</div>
					{showClose ? (
						<button
							type="button"
							onClick={onClose}
							className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-subtle text-text-secondary transition hover:border-border-hover hover:bg-bg-hover hover:text-text-primary"
							aria-label="Close session details"
						>
							<X size={16} aria-hidden="true" />
						</button>
					) : null}
				</div>
				<div className="mt-2 grid grid-cols-2 gap-2 text-xs text-text-secondary">
					{showStatus ? (
						<div>
							<div className="text-text-tertiary">Status</div>
							<div>{run?.status ?? agent?.state ?? (isLoading ? "loading" : "n/a")}</div>
						</div>
					) : null}
					<div>
						<div className="text-text-tertiary">Turns</div>
						<div>{run?.turnCount ?? agent?.turnCount ?? 0}</div>
					</div>
					<div>
						<div className="text-text-tertiary">Tools</div>
						<div>{run?.toolCount ?? agent?.toolCount ?? 0}</div>
					</div>
				</div>
				</div>
			)}

			<div className={`min-h-0 flex-1 overflow-y-auto ${compactTasks ? "space-y-2 p-2 pt-3" : "space-y-4 p-4"}`}>
				{isMain ? (
					<>
						{planChecklist ? (
							<section>
								<h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">Plan Progress</h2>
								<ChecklistProgressBlock checklist={planChecklist} />
							</section>
						) : runProgress ? (
							<section>
								<h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">Run Progress</h2>
								<RunProgressCard progress={runProgress} />
							</section>
						) : null}

						<TaskSidebarSection sessionId={agent?.sessionId} compact={compactTasks} />

						{compactTasks ? null : <SessionInfoWidget agent={agent} />}
					</>
				) : (
					<>
						<section>
							<div className="mb-2 flex items-center justify-between gap-2">
								<h2 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Input</h2>
								<CopyButton text={input} label="Copy" />
							</div>
							<pre className="max-h-72 overflow-auto rounded border border-border-subtle bg-bg px-3 py-2 font-mono text-xs leading-relaxed text-text-secondary whitespace-pre-wrap">
								{input || "No run input recorded yet."}
							</pre>
						</section>

						{systemPrompt ? (
							<section>
								<div className="mb-2 flex items-center justify-between gap-2">
									<h2 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">System Prompt</h2>
									<CopyButton text={systemPrompt} label="Copy" />
								</div>
								<pre className="max-h-56 overflow-auto rounded border border-border-subtle bg-bg px-3 py-2 font-mono text-xs leading-relaxed text-text-secondary whitespace-pre-wrap">
									{systemPrompt}
								</pre>
							</section>
						) : null}

						<section>
							<div className="mb-2 flex items-center justify-between gap-2">
								<h2 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Output</h2>
								<CopyButton text={output} label="Copy" />
							</div>
							<div className="rounded border border-border-subtle bg-bg px-3 py-2">
								{output ? <MarkdownRenderer content={output} /> : <div className="text-xs text-text-muted">No output recorded yet.</div>}
							</div>
						</section>
					</>
				)}

				{compactTasks ? null : (
					<div className="border-t border-border-subtle pt-3 text-xs text-text-tertiary">
						<div>Started: {formatTime(run?.startedAt ?? agent?.startTime)}</div>
						<div>Updated: {formatTime(run?.updatedAt ?? agent?.lastActivityAt)}</div>
						<div>Completed: {formatTime(run?.completedAt ?? agent?.endTime)}</div>
					</div>
				)}
			</div>
		</div>
	);
}

interface RunProgress {
	runId: string;
	completed: number;
	failed: number;
	running: number;
	queued: number;
	total: number;
	percent: number;
}

function SessionInfoWidget({ agent }: { agent?: SubAgentInstanceState }) {
	const sessionId = agent?.sessionId ?? "";
	return (
		<section className="rounded border border-border-subtle bg-bg px-3 py-2 text-xs leading-relaxed text-text-secondary">
			<div className="grid grid-cols-2 gap-3">
				<div>
					<div className="text-text-tertiary">Duration</div>
					<div className="mt-1 text-text-primary">{formatDuration(agent?.durationMs ?? 0)}</div>
				</div>
				<div>
					<div className="text-text-tertiary">Session ID</div>
					<div className="mt-1">
						<CopyButton text={sessionId} label="Copy" />
					</div>
				</div>
			</div>
		</section>
	);
}

function getRunProgress(agents: SubAgentInstanceState[], mainThreadId: string): RunProgress | null {
	const subagents = agents.filter((item) => item.kind === "subagent" && item.parentThreadId === mainThreadId && item.runId);
	if (subagents.length === 0) return null;

	const latestRunId = subagents.reduce((latest, item) => {
		const latestAgent = subagents.find((candidate) => candidate.runId === latest);
		if (!latestAgent) return item.runId ?? latest;
		return (item.startTime ?? 0) > (latestAgent.startTime ?? 0) ? item.runId ?? latest : latest;
	}, subagents[0]?.runId ?? "");

	const runAgents = subagents.filter((item) => item.runId === latestRunId);
	const completed = runAgents.filter((item) => item.state === "completed").length;
	const failed = runAgents.filter((item) => item.state === "failed" || item.state === "timed_out" || item.state === "cancelled").length;
	const queued = runAgents.filter((item) => item.state === "created" || item.state === "starting").length;
	const running = runAgents.filter((item) => item.state === "running" || item.state === "completing" || item.state === "paused").length;
	const total = runAgents.length;
	const finished = completed + failed;
	const percent = total > 0 ? Math.round((finished / total) * 100) : 0;

	return { runId: latestRunId, completed, failed, running, queued, total, percent };
}

function RunProgressCard({ progress }: { progress: RunProgress }) {
	return (
		<div className="rounded border border-border-default bg-bg px-3 py-2">
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0">
					<div className="truncate text-sm font-medium text-text-primary">{progress.runId}</div>
					<div className="mt-0.5 truncate text-xs text-text-muted">
						{progress.completed}/{progress.total} completed
					</div>
				</div>
				<div className="shrink-0 text-sm font-semibold text-text-primary">{progress.percent}%</div>
			</div>
			<div className="mt-2 h-1.5 overflow-hidden rounded bg-bg-surface">
				<div className="h-full bg-success" style={{ width: `${progress.percent}%` }} />
			</div>
			<div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-muted">
				<span>Running {progress.running}</span>
				<span>Queued {progress.queued}</span>
				<span>Failed {progress.failed}</span>
			</div>
		</div>
	);
}

function isTodoMockMode(): boolean {
	if (typeof window === "undefined") return false;
	return new URLSearchParams(window.location.search).get("mock") === "todos";
}

function formatDuration(value: number): string {
	if (value <= 0) return "n/a";
	const seconds = Math.round(value / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	if (minutes < 60) return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}
