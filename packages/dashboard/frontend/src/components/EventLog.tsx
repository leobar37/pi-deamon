import { useMemo, useRef, useEffect, useState } from "react";
import { useDashboardStore } from "../store/dashboard.js";

function formatTimeAgo(timestamp: number): string {
	const diff = Date.now() - timestamp;
	if (diff < 1000) return "just now";
	if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
	if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
	return `${Math.floor(diff / 3600000)}h ago`;
}

function formatTimestamp(timestamp: number): string {
	const d = new Date(timestamp);
	return d.toLocaleTimeString();
}

export function EventLog() {
	const events = useDashboardStore((s) => s.events);
	const sourceFilter = useDashboardStore((s) => s.sourceFilter);
	const typeFilter = useDashboardStore((s) => s.typeFilter);
	const clearEvents = useDashboardStore((s) => s.clearEvents);
	const setSourceFilter = useDashboardStore((s) => s.setSourceFilter);
	const setTypeFilter = useDashboardStore((s) => s.setTypeFilter);
	const scrollRef = useRef<HTMLDivElement>(null);
	const [autoScroll, setAutoScroll] = useState(true);
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const filteredEvents = useMemo(() => {
		return events.filter((e) => {
			if (sourceFilter !== "all" && e.source !== sourceFilter) return false;
			if (typeFilter && !e.type.includes(typeFilter)) return false;
			return true;
		});
	}, [events, sourceFilter, typeFilter]);

	useEffect(() => {
		if (autoScroll && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [filteredEvents, autoScroll]);

	return (
		<div className="flex flex-col h-full">
			<div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-gray-900 border-b border-gray-800">
				<div className="flex items-center gap-2">
					<span className="text-xs text-gray-500 uppercase tracking-wider">Source</span>
					<select
						value={sourceFilter}
						onChange={(e) => setSourceFilter(e.target.value as "all" | "lion" | "subagent")}
						className="bg-gray-800 text-gray-200 text-sm rounded px-2 py-1 border border-gray-700"
					>
						<option value="all">All</option>
						<option value="lion">Lion</option>
						<option value="subagent">SubAgent</option>
					</select>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-xs text-gray-500 uppercase tracking-wider">Type</span>
					<input
						type="text"
						value={typeFilter ?? ""}
						onChange={(e) => setTypeFilter(e.target.value || null)}
						placeholder="Filter..."
						className="bg-gray-800 text-gray-200 text-sm rounded px-2 py-1 border border-gray-700 w-40"
					/>
				</div>
				<div className="flex items-center gap-2 ml-auto">
					<label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
						<input
							type="checkbox"
							checked={autoScroll}
							onChange={(e) => setAutoScroll(e.target.checked)}
							className="rounded"
						/>
						Auto-scroll
					</label>
					<button
						onClick={clearEvents}
						className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-700"
					>
						Clear
					</button>
				</div>
				<div className="text-xs text-gray-500">{filteredEvents.length} events</div>
			</div>
			<div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1">
				{filteredEvents.length === 0 && (
					<div className="text-gray-500 text-sm text-center py-8">No events yet</div>
				)}
				{filteredEvents.map((event) => (
					<div
						key={event.id}
						className="flex items-start gap-2 p-2 rounded bg-gray-900 hover:bg-gray-800 cursor-pointer"
						onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
					>
						<span
							className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded mt-0.5 ${
								event.source === "lion"
									? "bg-blue-900/50 text-blue-300"
									: "bg-green-900/50 text-green-300"
							}`}
						>
							{event.source}
						</span>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2">
								<span className="text-xs text-gray-300 font-mono">{event.type}</span>
								<span className="text-[10px] text-gray-500" title={formatTimestamp(event.timestamp)}>
									{formatTimeAgo(event.timestamp)}
								</span>
							</div>
							{expandedId === event.id && (
								<pre className="text-[11px] text-gray-400 mt-1 overflow-x-auto bg-gray-950 p-2 rounded">
									{JSON.stringify(event.payload, null, 2)}
								</pre>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
