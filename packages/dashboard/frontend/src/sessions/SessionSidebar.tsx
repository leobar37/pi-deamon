import { Bot, Plus, Search } from "lucide-react";
import type { CanvasSession } from "../electron.js";

interface SessionSidebarProps {
	sessions: CanvasSession[];
	activeSessionId: string | null;
	focusedSessionId: string | null;
	onFocusSession: (sessionId: string) => void;
	onCreateSession: () => void;
}

export function SessionSidebar({
	sessions,
	activeSessionId,
	focusedSessionId,
	onFocusSession,
	onCreateSession,
}: SessionSidebarProps) {
	return (
		<aside className="flex h-full w-72 shrink-0 flex-col border-r border-border-subtle bg-bg-elevated">
			<div className="border-b border-border-subtle px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<div className="text-sm font-semibold text-text-primary">Sessions</div>
						<div className="mt-0.5 text-xs text-text-tertiary">Focus agents on the canvas</div>
					</div>
					<button
						type="button"
						onClick={() => void onCreateSession()}
						className="flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle text-text-secondary transition hover:border-border-hover hover:bg-bg-hover hover:text-text-primary"
						title="Add session"
					>
						<Plus size={15} aria-hidden="true" />
					</button>
				</div>
			</div>

			<div className="border-b border-border-subtle px-3 py-3">
				<div className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg px-2.5 py-2 text-xs text-text-tertiary">
					<Search size={14} aria-hidden="true" />
					<span>Search coming soon</span>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
				{sessions.length === 0 ? (
					<div className="px-3 py-8 text-center text-sm text-text-muted">No sessions created.</div>
				) : (
					<div className="space-y-1">
						{sessions.map((session) => {
							const selected = session.id === focusedSessionId || session.id === activeSessionId;
							return (
								<button
									key={session.id}
									type="button"
									onClick={() => onFocusSession(session.id)}
									className={`w-full rounded-md border px-3 py-2.5 text-left transition ${
										selected
											? "border-accent/60 bg-accent-muted"
											: "border-transparent hover:border-border-subtle hover:bg-bg-hover"
									}`}
								>
									<div className="flex items-start gap-2.5">
										<div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-bg-surface text-accent">
											<Bot size={14} aria-hidden="true" />
										</div>
										<div className="min-w-0 flex-1">
											<div className="truncate text-sm font-medium text-text-primary">{session.name || `Session ${session.id.slice(0, 8)}`}</div>
											<div className="mt-2 text-[11px] text-text-tertiary">
												{new Date(session.createdAt).toLocaleTimeString()}
											</div>
										</div>
									</div>
								</button>
							);
						})}
					</div>
				)}
			</div>
		</aside>
	);
}
