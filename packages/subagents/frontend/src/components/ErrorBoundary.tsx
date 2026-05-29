import { Component, type ErrorInfo, type ReactNode } from "react";
import { dashboardDebugLedger } from "../dev/debug-ledger.ts";

interface ErrorBoundaryProps {
	threadId?: string | null;
	children: ReactNode;
}

interface ErrorBoundaryState {
	error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	state: ErrorBoundaryState = { error: null };

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo): void {
		dashboardDebugLedger.log("error", "render", "error-boundary", { error, componentStack: info.componentStack }, this.props.threadId ?? undefined);
	}

	componentDidUpdate(previousProps: ErrorBoundaryProps): void {
		if (previousProps.threadId !== this.props.threadId && this.state.error) {
			this.setState({ error: null });
		}
	}

	render() {
		if (!this.state.error) return this.props.children;
		return (
			<div className="flex h-full items-center justify-center bg-bg-base px-6">
				<div className="max-w-md rounded-lg border border-border-default bg-bg-elevated p-4">
					<div className="text-sm font-medium text-text-primary">Dashboard render failed</div>
					<div className="mt-2 text-xs leading-relaxed text-text-secondary">
						The current thread view could not be rendered. The dev debug ledger has captured the latest events and message state.
					</div>
					<button
						type="button"
						className="mt-4 rounded-md border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
						onClick={() => this.setState({ error: null })}
					>
						Retry
					</button>
				</div>
			</div>
		);
	}
}
