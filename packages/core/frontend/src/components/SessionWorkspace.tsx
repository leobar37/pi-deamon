import { useEffect, useState } from "react";
import { PanelRight, PanelRightClose } from "lucide-react";
import type { SubAgentInstanceState } from "../types.ts";
import { useAgent } from "../hooks/use-agent.ts";
import { useAgentMessages } from "../hooks/use-agent-messages.ts";
import { useAgentRun } from "../hooks/use-agent-run.ts";
import { useLionState } from "../hooks/use-lion-state.ts";
import { useSseEvents } from "../hooks/use-sse.ts";
import { MOCK_TODO_AGENT, MOCK_TODO_MESSAGES } from "../mocks/tasks.ts";
import { useSubAgentStore } from "../store/use-subagent-store.ts";
import { useSessionMessagesStore } from "../store/session-messages.ts";
import { navigateToThread } from "../navigation.ts";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { AgentRunSidebar } from "./AgentRunSidebar.tsx";
import { ChatComposer } from "./ChatComposer.tsx";
import { ChatView } from "./ChatView.tsx";
import { isLionUiActive, LionModeBadge } from "./LionModeBadge.tsx";
import { StatusBadge } from "./StatusBadge.tsx";
import { SubagentListPanel } from "./SubagentListPanel.tsx";

export type SessionWorkspaceVariant = "full" | "canvas" | "embed";

export interface SessionWorkspaceProps {
	threadId: string;
	variant: SessionWorkspaceVariant;
	onBack?: () => void;
}

export function SessionWorkspace({ threadId, variant, onBack }: SessionWorkspaceProps) {
	const { data: fetchedAgent } = useAgent(threadId);
	const { data: fetchedMessages } = useAgentMessages(threadId);
	const { data: fetchedRun, isLoading: isRunLoading } = useAgentRun(threadId);
	const { data: lionState } = useLionState();
	const embedded = variant !== "full";
	const todoMockMode = isTodoMockMode();
	const [sidebarOpen, setSidebarOpen] = useState(!embedded || todoMockMode);

	useSseEvents(threadId, todoMockMode);

	const setMessages = useSessionMessagesStore((s) => s.setMessages);
	const storeAgents = useSubAgentStore((s) => s.agents);
	const agents = todoMockMode ? [MOCK_TODO_AGENT] : storeAgents.length > 0 ? storeAgents : useSubAgentStore.getState().agents;
	const storeAgent = agents.find((agent) => agent.instanceId === threadId);

	useEffect(() => {
		if (todoMockMode) {
			setMessages(threadId, MOCK_TODO_MESSAGES);
		} else if (fetchedMessages) {
			setMessages(threadId, fetchedMessages);
		}
	}, [fetchedMessages, threadId, setMessages, todoMockMode]);

	const displayAgent: SubAgentInstanceState | undefined = storeAgent ?? fetchedAgent ?? undefined;
	const parentThread = displayAgent?.parentThreadId
		? agents.find((agent) => agent.instanceId === displayAgent.parentThreadId)
		: null;
	const isMainThread = displayAgent?.kind === "main";
	const subagentParentThreadId = isMainThread ? displayAgent?.instanceId : displayAgent?.parentThreadId;
	const effectiveLionState = todoMockMode ? undefined : lionState;
	const isLionActive = isLionUiActive(effectiveLionState);
	const showMainNavigation = !isMainThread || isLionActive;
	const showStateBadge = !isMainThread;
	const showHeader = Boolean(displayAgent && (!isMainThread || showMainNavigation));
	const showEmbeddedSummary = embedded && Boolean(displayAgent);

	const navigateWithinWorkspace = (nextThreadId: string | null) => {
		if (!nextThreadId) {
			onBack?.();
			return;
		}
		navigateToThread(nextThreadId, variant);
	};

	const toggleSidebar = () => setSidebarOpen((prev) => !prev);

	return (
		<div className="relative flex h-full min-w-0 flex-1 flex-col bg-bg-base">
			{showHeader && displayAgent ? (
				<SessionHeader
					agent={displayAgent}
					parentThread={parentThread}
					lionState={effectiveLionState}
					showMainNavigation={showMainNavigation}
					showStateBadge={showStateBadge}
					sidebarOpen={sidebarOpen}
					showSidebarToggle={!embedded}
					onBack={onBack}
					onParentSelect={navigateWithinWorkspace}
					onToggleSidebar={toggleSidebar}
				/>
			) : null}

			<div className="flex min-h-0 flex-1 overflow-hidden">
				{embedded ? (
					<SubagentListPanel
						activeThreadId={threadId}
						agentsOverride={agents}
						parentThreadId={subagentParentThreadId}
						presentation="drawer"
						onSelectThread={(nextThreadId) => navigateWithinWorkspace(nextThreadId)}
					/>
				) : null}
				<div className="min-w-0 flex-1 overflow-hidden">
					<ErrorBoundary threadId={threadId}>
						<div className="flex h-full min-w-0 flex-col">
							{displayAgent && (showEmbeddedSummary || !sidebarOpen) ? (
								<SessionSummaryBar
									agent={displayAgent}
									run={fetchedRun}
									showDetailsButton={embedded}
									detailsOpen={sidebarOpen}
									onToggleDetails={toggleSidebar}
								/>
							) : null}
							<div className="min-h-0 flex-1 overflow-hidden">
								<ChatView instanceId={threadId} />
							</div>
							<ChatComposer instanceId={threadId} thread={displayAgent} />
						</div>
					</ErrorBoundary>
				</div>
				<AgentRunSidebar
					agent={displayAgent}
					run={fetchedRun}
					isLoading={isRunLoading}
					isOpen={sidebarOpen}
					presentation={embedded ? "drawer" : "sidebar"}
					onClose={() => setSidebarOpen(false)}
				/>
			</div>
		</div>
	);
}

function isTodoMockMode(): boolean {
	if (typeof window === "undefined") return false;
	return new URLSearchParams(window.location.search).get("mock") === "todos";
}

function SessionHeader({
	agent,
	parentThread,
	lionState,
	showMainNavigation,
	showStateBadge,
	sidebarOpen,
	showSidebarToggle,
	onBack,
	onParentSelect,
	onToggleSidebar,
}: {
	agent: SubAgentInstanceState;
	parentThread: SubAgentInstanceState | null | undefined;
	lionState: ReturnType<typeof useLionState>["data"];
	showMainNavigation: boolean;
	showStateBadge: boolean;
	sidebarOpen: boolean;
	showSidebarToggle: boolean;
	onBack?: () => void;
	onParentSelect: (threadId: string | null) => void;
	onToggleSidebar: () => void;
}) {
	const isMainThread = agent.kind === "main";

	return (
		<div className="flex items-center gap-3 border-b border-border-subtle bg-bg-elevated/70 px-4 py-2">
			{agent.parentThreadId ? (
				<button
					type="button"
					onClick={() => onParentSelect(agent.parentThreadId ?? null)}
					className="text-sm text-text-secondary transition-colors hover:text-text-primary"
				>
					← {parentThread?.kind === "main" ? "Main session" : parentThread?.description || "Parent thread"}
				</button>
			) : showMainNavigation ? (
				<button
					type="button"
					onClick={onBack}
					className="text-sm text-text-secondary transition-colors hover:text-text-primary"
				>
					Lion
				</button>
			) : null}
			<div className="flex min-w-0 flex-1 items-center gap-2">
				{showStateBadge ? <StatusBadge state={agent.state} pulse={agent.state === "running"} /> : null}
				{!isMainThread ? (
					<span className="truncate text-sm font-medium text-text-primary">
						{agent.description || agent.definitionName}
					</span>
				) : null}
				<LionModeBadge state={lionState} />
			</div>
			{showSidebarToggle ? (
				<button
					type="button"
					onClick={onToggleSidebar}
					className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
					title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
				>
					{sidebarOpen ? (
						<PanelRightClose className="h-4 w-4" aria-hidden="true" />
					) : (
						<PanelRight className="h-4 w-4" aria-hidden="true" />
					)}
				</button>
			) : null}
		</div>
	);
}

function SessionSummaryBar({
	agent,
	run,
	showDetailsButton = false,
	detailsOpen = false,
	onToggleDetails,
}: {
	agent?: SubAgentInstanceState;
	run?: { turnCount?: number; toolCount?: number; durationMs?: number };
	showDetailsButton?: boolean;
	detailsOpen?: boolean;
	onToggleDetails?: () => void;
}) {
	return (
		<div className="flex items-center gap-4 border-b border-border-subtle bg-bg-elevated px-4 py-1.5 text-xs text-text-tertiary">
			<span>
				Turns <span className="text-text-secondary">{run?.turnCount ?? agent?.turnCount ?? 0}</span>
			</span>
			<span>
				Tools <span className="text-text-secondary">{run?.toolCount ?? agent?.toolCount ?? 0}</span>
			</span>
			<span className="ml-auto">{formatDurationCompact(run?.durationMs ?? agent?.durationMs ?? 0)}</span>
			{showDetailsButton ? (
				<button
					type="button"
					onClick={onToggleDetails}
					className="rounded border border-border-subtle px-2 py-1 text-[11px] text-text-secondary transition hover:border-border-hover hover:bg-bg-hover hover:text-text-primary"
				>
					{detailsOpen ? "Hide details" : "Details"}
				</button>
			) : null}
		</div>
	);
}

function formatDurationCompact(value: number): string {
	if (value <= 0) return "0s";
	const seconds = Math.round(value / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h ${minutes % 60}m`;
}
