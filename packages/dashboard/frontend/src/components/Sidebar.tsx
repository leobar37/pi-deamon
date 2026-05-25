/**
 * Sidebar — ChatGPT-style hierarchical navigation.
 * Sections: global actions, temporal chat groups, expandable projects.
 */

import { useMemo, useState, useCallback } from "react";

import { useSessionsByCwd, useSessionList, useSessionRuntime, type SessionEntry } from "../store/index.js";
import { createOptimisticManager } from "../store/optimistic.js";
import { createActions } from "../store/actions.js";
import { navigateToSession } from "../App.js";

// ---------------------------------------------------------------------------
// Icons (inline SVG)
// ---------------------------------------------------------------------------

function IconPlus(props: { className?: string }) {
	return (
		<svg className={props.className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
		</svg>
	);
}

function IconSearch(props: { className?: string }) {
	return (
		<svg className={props.className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
		</svg>
	);
}

function IconChevronRight(props: { className?: string }) {
	return (
		<svg className={props.className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
		</svg>
	);
}

function IconChevronDown(props: { className?: string }) {
	return (
		<svg className={props.className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
		</svg>
	);
}

function IconSparkles(props: { className?: string }) {
	return (
		<svg className={props.className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
		</svg>
	);
}

function IconZap(props: { className?: string }) {
	return (
		<svg className={props.className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
		</svg>
	);
}

function IconPanelLeftClose(props: { className?: string }) {
	return (
		<svg className={props.className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
		</svg>
	);
}

function IconPanelLeftOpen(props: { className?: string }) {
	return (
		<svg className={props.className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
		</svg>
	);
}

function IconMessageSquare(props: { className?: string }) {
	return (
		<svg className={props.className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
		</svg>
	);
}

function IconFolder(props: { className?: string }) {
	return (
		<svg className={props.className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
		</svg>
	);
}

// ---------------------------------------------------------------------------
// Temporal grouping helpers
// ---------------------------------------------------------------------------

type TimeBucket = "hoy" | "ayer" | "ultimos7" | "ultimos30" | "anteriores";

const BUCKET_LABELS: Record<TimeBucket, string> = {
	hoy: "Hoy",
	ayer: "Ayer",
	ultimos7: "\u00daltimos 7 d\u00edas",
	ultimos30: "\u00daltimos 30 d\u00edas",
	anteriores: "Anteriores",
};

const BUCKET_ORDER: TimeBucket[] = ["hoy", "ayer", "ultimos7", "ultimos30", "anteriores"];

function getTimeBucket(ts: number): TimeBucket {
	const now = new Date();
	const date = new Date(ts);
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / 86_400_000);

	const isSameDay = (a: Date, b: Date) =>
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate();

	if (isSameDay(now, date)) return "hoy";

	const yesterday = new Date(now);
	yesterday.setDate(yesterday.getDate() - 1);
	if (isSameDay(yesterday, date)) return "ayer";

	if (diffDays < 7) return "ultimos7";
	if (diffDays < 30) return "ultimos30";
	return "anteriores";
}

function groupSessionsByTime(entries: SessionEntry[]): Map<TimeBucket, SessionEntry[]> {
	const map = new Map<TimeBucket, SessionEntry[]>();
	for (const entry of entries) {
		const bucket = getTimeBucket(entry.info.lastActivityAt);
		const arr = map.get(bucket) ?? [];
		arr.push(entry);
		map.set(bucket, arr);
	}
	// Sort each bucket by lastActivityAt desc
	for (const arr of map.values()) {
		arr.sort((a, b) => b.info.lastActivityAt - a.info.lastActivityAt);
	}
	return map;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SidebarProps {
	activeSessionId: string | null;
}

export function Sidebar({ activeSessionId }: SidebarProps) {
	const sessionsByCwd = useSessionsByCwd();
	const sessionList = useSessionList();
	const [expandedCwds, setExpandedCwds] = useState<Set<string>>(new Set());
	const [collapsed, setCollapsed] = useState(false);

	const runtime = useSessionRuntime();

	// Stable actions instance
	const actions = useMemo(() => {
		const optimistic = createOptimisticManager(runtime);
		return createActions(runtime, optimistic);
	}, [runtime]);

	const toggleCwd = (cwd: string) => {
		const next = new Set(expandedCwds);
		if (next.has(cwd)) {
			next.delete(cwd);
		} else {
			next.add(cwd);
		}
		setExpandedCwds(next);
	};

	const handleNewChat = useCallback(async () => {
		const session = await actions.createSession();
		if (session) {
			navigateToSession(session.id);
		}
	}, [actions]);

	// Flatten all sessions for temporal grouping
	const sessionsByTime = useMemo(() => groupSessionsByTime(sessionList), [sessionList]);

	// -----------------------------------------------------------------------
	// Collapsed state
	// -----------------------------------------------------------------------

	if (collapsed) {
		return (
			<aside className="flex flex-col items-center w-12 bg-bg-sidebar border-r border-border-subtle py-3 gap-3 select-none">
				<button
					onClick={() => setCollapsed(false)}
					className="text-text-secondary hover:text-text-primary p-1.5 rounded-md hover:bg-bg-hover transition-colors"
					title="Expand sidebar"
				>
					<IconPanelLeftOpen className="w-5 h-5" />
				</button>
				<div
					className="w-2 h-2 rounded-full bg-success"
					title="Connected"
				/>
			</aside>
		);
	}

	// -----------------------------------------------------------------------
	// Expanded state
	// -----------------------------------------------------------------------

	return (
		<aside className="flex flex-col w-64 bg-bg-elevated border-r border-border-subtle h-full overflow-hidden select-none">
			{/* Header */}
			<div className="flex items-center justify-between px-3.5 py-3.5 border-b border-border-subtle">
				<button
					onClick={() => navigateToSession(null)}
					className="text-base font-semibold tracking-tight text-text-primary hover:text-text-secondary transition-colors"
				>
					Pi
				</button>
				<div className="flex items-center gap-2">
					<button
						onClick={handleNewChat}
						className="text-text-secondary hover:text-text-primary p-1 rounded-md hover:bg-bg-surface transition-colors"
						title="New chat"
					>
						<IconPlus className="w-4 h-4" />
					</button>
					<button
						onClick={() => setCollapsed(true)}
						className="text-text-tertiary hover:text-text-secondary p-1 rounded-md hover:bg-bg-surface transition-colors"
						title="Collapse sidebar"
					>
						<IconPanelLeftClose className="w-4 h-4" />
					</button>
				</div>
			</div>

			{/* Global actions */}
			<div className="px-3 py-2.5 flex flex-col gap-0.5">
				<button className="w-full rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-colors flex items-center gap-2.5">
					<IconSearch className="w-4 h-4" />
					Buscar
				</button>

				<button className="w-full rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-colors flex items-center gap-2.5">
					<IconSparkles className="w-4 h-4" />
					Complementos
				</button>

				<button className="w-full rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-colors flex items-center gap-2.5">
					<IconZap className="w-4 h-4" />
					Automatizaciones
				</button>
			</div>

			{/* Divider */}
			<div className="mx-3.5 h-px bg-border-subtle my-1" />

			{/* Scrollable content */}
			<div className="flex-1 overflow-y-auto min-h-0">
				{/* Temporal groups */}
				{sessionsByTime.size > 0 && (
					<div className="px-3 py-2">
						{BUCKET_ORDER.filter((b) => sessionsByTime.has(b)).map((bucket) => (
							<div key={bucket} className="mb-2">
								<div className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-text-muted">
									{BUCKET_LABELS[bucket]}
								</div>
								<div className="flex flex-col gap-0.5">
									{(sessionsByTime.get(bucket) ?? []).map((entry) => (
										<button
											key={entry.info.id}
											onClick={() => navigateToSession(entry.info.id)}
											className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-all ${
												activeSessionId === entry.info.id
													? "bg-bg-surface text-text-primary border-r-2 border-accent"
													: "text-text-secondary hover:bg-bg-surface hover:text-text-primary"
											}`}
										>
											<IconMessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-text-muted" />
											<span className="truncate flex-1">
												{entry.info.name || entry.info.id.slice(0, 8)}
											</span>
											{entry.streaming && (
												<span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse flex-shrink-0" />
											)}
										</button>
									))}
								</div>
							</div>
						))}
					</div>
				)}

				{/* Divider between temporal and projects */}
				{sessionsByTime.size > 0 && sessionsByCwd.size > 0 && (
					<div className="mx-3.5 h-px bg-border-subtle my-1" />
				)}

				{/* Projects (cwd groups) */}
				{sessionsByCwd.size > 0 && (
					<div className="px-3 py-2">
						<div className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-text-muted">
							Proyectos
						</div>
						{Array.from(sessionsByCwd.entries()).map(([cwd, entries]) => {
							const dirName = cwd.split("/").pop() || cwd;
							const isExpanded = expandedCwds.has(cwd);

							return (
								<div key={cwd}>
									<button
										onClick={() => toggleCwd(cwd)}
										className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-colors"
									>
										{isExpanded ? (
											<IconChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-text-muted" />
										) : (
											<IconChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-text-muted" />
										)}
										<IconFolder className="w-3.5 h-3.5 flex-shrink-0 text-text-muted" />
										<span className="truncate flex-1">{dirName}</span>
										<span className="text-[10px] text-text-muted flex-shrink-0">
											{entries.length}
										</span>
									</button>

									{isExpanded && (
										<div className="flex flex-col gap-0.5 pl-8 pr-1">
											{entries.map((entry) => (
												<button
													key={entry.info.id}
													onClick={() => navigateToSession(entry.info.id)}
													className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-all ${
														activeSessionId === entry.info.id
															? "bg-bg-surface text-text-primary border-r-2 border-accent"
															: "text-text-secondary hover:bg-bg-surface hover:text-text-primary"
													}`}
												>
													<span className="truncate flex-1">
														{entry.info.name || entry.info.id.slice(0, 8)}
													</span>
													{entry.streaming && (
														<span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse flex-shrink-0" />
													)}
												</button>
											))}
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}

				{sessionsByCwd.size === 0 && sessionsByTime.size === 0 && (
					<div className="px-4 py-8 text-sm text-text-muted text-center">
						No hay sesiones. Inicia un nuevo chat.
					</div>
				)}
			</div>
		</aside>
	);
}
