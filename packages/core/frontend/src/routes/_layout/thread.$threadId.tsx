import { createFileRoute } from "@tanstack/react-router";
import { AgentDetail } from "../../components/AgentDetail.tsx";
import { SessionWorkspace, type SessionWorkspaceVariant } from "../../components/SessionWorkspace.tsx";
import { navigateToThread } from "../../navigation.ts";
import { useSubAgentStore } from "../../store/use-subagent-store.ts";

export const Route = createFileRoute("/_layout/thread/$threadId")({
	component: ThreadRoute,
});

function ThreadRoute() {
	const { threadId } = Route.useParams();
	const mainThread = useSubAgentStore((s) => s.agents.find((agent) => agent.kind === "main")) ?? null;
	const variant = getSessionWorkspaceVariant();

	if (variant !== "full") {
		return <SessionWorkspace threadId={threadId} variant={variant} />;
	}

	return (
		<AgentDetail
			instanceId={threadId}
			onBack={() => navigateToThread(mainThread?.instanceId ?? null)}
		/>
	);
}

function getSessionWorkspaceVariant(): SessionWorkspaceVariant {
	if (typeof window === "undefined") return "full";
	const params = new URLSearchParams(window.location.search);
	if (params.get("canvas") === "1") return "canvas";
	if (params.get("embed") === "1") return "embed";
	return "full";
}
