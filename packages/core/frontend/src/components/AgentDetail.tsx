import { SessionWorkspace } from "./SessionWorkspace.tsx";

interface AgentDetailProps {
  instanceId: string;
  onBack: () => void;
}

export function AgentDetail({ instanceId, onBack }: AgentDetailProps) {
	return <SessionWorkspace threadId={instanceId} variant="full" onBack={onBack} />;
}
