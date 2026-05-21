import { ConnectionStatus } from "./components/ConnectionStatus.js";
import { EventLog } from "./components/EventLog.js";
import { EventStream } from "./components/EventStream.js";

export default function App() {
	return (
		<div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
			<header className="px-4 py-3 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
				<h1 className="text-lg font-bold tracking-tight">Pi Dashboard</h1>
				<span className="text-xs text-gray-500">Real-time orchestrator events</span>
			</header>
			<ConnectionStatus />
			<main className="flex-1 flex flex-col min-h-0">
				<EventLog />
			</main>
			<EventStream />
		</div>
	);
}
