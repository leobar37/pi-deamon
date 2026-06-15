import { createFileRoute } from "@tanstack/react-router";
import { AgentDetail } from "../../components/AgentDetail.tsx";
import { CanvasSessionPreview } from "../../components/CanvasSessionPreview.tsx";
import { navigateToThread } from "../../navigation.ts";
import { useSubAgentStore } from "../../store/use-subagent-store.ts";

export const Route = createFileRoute("/_layout/thread/$threadId")({
	component: ThreadRoute,
});

function ThreadRoute() {
	const { threadId } = Route.useParams();
	const mainThread = useSubAgentStore((s) => s.agents.find((agent) => agent.kind === "main")) ?? null;
	const isCanvasPreview =
		typeof window !== "undefined" && new URLSearchParams(window.location.search).get("canvas") === "1";

	if (isCanvasPreview) {
		return <CanvasSessionPreview threadId={threadId} />;
	}

	return (
		<AgentDetail
			instanceId={threadId}
			onBack={() => navigateToThread(mainThread?.instanceId ?? null)}
		/>
	);
}
