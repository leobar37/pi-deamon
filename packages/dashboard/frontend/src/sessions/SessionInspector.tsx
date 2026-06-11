import { ExternalLink, PanelRightClose, Server, X } from "lucide-react";
import type { SessionEntry } from "../store/index.js";

interface SessionInspectorProps {
	session: SessionEntry | undefined;
	onClose: () => void;
}

export function SessionInspector({ session, onClose }: SessionInspectorProps) {
	if (!session) {
		return (
			<aside className="hidden h-full w-[420px] shrink-0 border-l border-border-subtle bg-bg-elevated xl:flex xl:flex-col">
				<div className="flex flex-1 items-center justify-center px-8 text-center">
					<div>
						<div className="text-sm font-semibold text-text-primary">No focused session</div>
						<div className="mt-2 text-sm leading-normal text-text-secondary">Select a session from the sidebar or canvas to inspect its agent runtime.</div>
					</div>
				</div>
			</aside>
		);
	}

	return (
		<aside className="hidden h-full w-[360px] shrink-0 border-l border-border-subtle bg-bg-base xl:flex xl:flex-col">
			<div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-elevated px-4 py-3">
				<div className="min-w-0">
					<div className="truncate text-sm font-semibold text-text-primary">{session.info.name || `Session ${session.info.id.slice(0, 8)}`}</div>
					<div className="mt-0.5 truncate text-xs text-text-tertiary">{session.info.cwd}</div>
				</div>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={onClose}
						className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition hover:bg-bg-hover hover:text-text-primary"
						title="Close inspector"
					>
						<PanelRightClose size={16} aria-hidden="true" />
					</button>
					<button
						type="button"
						onClick={onClose}
						className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition hover:bg-bg-hover hover:text-text-primary"
						title="Clear focus"
					>
						<X size={16} aria-hidden="true" />
					</button>
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-auto p-4">
				<div className="space-y-4">
					<div>
						<div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">Runtime</div>
						<div className="rounded-lg border border-border-subtle bg-bg-elevated">
							<dl className="divide-y divide-border-subtle text-sm">
								<div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 px-3 py-2.5">
									<dt className="text-text-tertiary">Status</dt>
									<dd className="truncate font-medium text-text-primary">{session.info.status}</dd>
								</div>
								<div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 px-3 py-2.5">
									<dt className="text-text-tertiary">PID</dt>
									<dd className="truncate font-medium text-text-primary">{session.info.processId ?? "not started"}</dd>
								</div>
								<div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 px-3 py-2.5">
									<dt className="text-text-tertiary">Messages</dt>
									<dd className="truncate font-medium text-text-primary">{session.info.messageCount}</dd>
								</div>
							</dl>
						</div>
					</div>

					<div>
						<div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">Embedded UI</div>
						<div className="rounded-lg border border-border-subtle bg-bg-elevated p-3">
							<div className="flex items-start gap-3">
								<div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-base text-accent-primary">
									<Server size={15} aria-hidden="true" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="text-sm font-medium text-text-primary">Subagents frontend</div>
									<div className="mt-1 break-all text-xs leading-relaxed text-text-tertiary">{session.info.uiUrl ?? "starting"}</div>
									{session.info.uiUrl ? (
										<a
											href={session.info.uiUrl}
											target="_blank"
											rel="noreferrer"
											className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent-primary hover:text-text-primary"
										>
											<ExternalLink size={13} aria-hidden="true" />
											Open standalone
										</a>
									) : null}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</aside>
	);
}
