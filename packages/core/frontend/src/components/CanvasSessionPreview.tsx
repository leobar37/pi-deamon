import { ExternalLink } from "lucide-react";

interface CanvasSessionPreviewProps {
	threadId: string;
}

export function CanvasSessionPreview({ threadId }: CanvasSessionPreviewProps) {
	const sessionUrl = `/thread/${encodeURIComponent(threadId)}?mock=1`;

	return (
		<div className="h-screen min-w-0 overflow-hidden bg-bg-base">
			<div className="relative h-full min-w-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:24px_24px]">
				<div className="absolute left-1/2 top-1/2 h-[min(760px,calc(100vh-6rem))] w-[min(980px,calc(100vw-6rem))] -translate-x-1/2 -translate-y-1/2 overflow-visible rounded-lg bg-bg-base shadow-md ring-2 ring-accent/20">
					<div className="flex h-11 items-center justify-between gap-3 bg-bg-elevated/55 px-3">
						<div className="min-w-0 flex-1">
							<div className="truncate text-sm font-medium text-text-primary">Canvas preview</div>
							<div className="truncate text-[11px] text-text-tertiary">{threadId}</div>
						</div>
						<div className="flex shrink-0 items-center gap-1.5 text-[11px] text-text-tertiary">
							<span className="h-1.5 w-1.5 rounded-full bg-text-muted" />
							Mock
						</div>
						<a
							href={sessionUrl}
							target="_blank"
							rel="noreferrer"
							title="Open standalone session"
							className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-tertiary transition hover:bg-bg-hover hover:text-text-primary"
						>
							<ExternalLink size={13} aria-hidden="true" />
						</a>
					</div>
					<div className="h-[calc(100%-44px)] bg-bg-base">
						<iframe
							src={sessionUrl}
							title={`Canvas preview for ${threadId}`}
							className="h-full w-full border-0"
							allow="clipboard-read; clipboard-write"
						/>
					</div>
					<div className="absolute -bottom-2 -right-2 h-5 w-5 border-b-2 border-r-2 border-accent" aria-hidden="true" />
					<div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-border-default bg-bg-hover" aria-hidden="true" />
					<div className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-border-default bg-bg-hover" aria-hidden="true" />
				</div>
			</div>
		</div>
	);
}
