import { useEffect } from "react";
import type { SubAgentEvent, SubAgentInstanceState } from "../types.ts";
import { useAgent } from "../hooks/use-agent.ts";
import { useAgentEvents } from "../hooks/use-agent-events.ts";
import { useAgentMessages } from "../hooks/use-agent-messages.ts";
import { ChatView } from "./ChatView.tsx";
import { StatusBadge } from "./StatusBadge.tsx";
import { useSubAgentStore } from "../store/use-subagent-store.ts";
import { useSessionMessagesStore } from "../store/session-messages.ts";
import { navigateToThread } from "../navigation.ts";
import { ErrorBoundary } from "./ErrorBoundary.tsx";

interface AgentDetailProps {
  instanceId: string;
  onBack: () => void;
}

export function AgentDetail({ instanceId, onBack }: AgentDetailProps) {
  const { data: fetchedAgent } = useAgent(instanceId);
  const { data: fetchedEvents } = useAgentEvents(instanceId);
  const { data: fetchedMessages } = useAgentMessages(instanceId);

  const setMessages = useSessionMessagesStore((s) => s.setMessages);
  const mergeEvents = useSubAgentStore((s) => s.mergeEvents);
  const agents = useSubAgentStore((s) => s.agents);

  const storeAgent = agents.find((a) => a.instanceId === instanceId);

  // Sync TanStack Query data into zustand stores on mount / change
  // mergeEvents preserves SSE events that arrived before the REST response
  useEffect(() => {
    if (fetchedEvents) {
      mergeEvents(fetchedEvents as SubAgentEvent[]);
    }
  }, [fetchedEvents, mergeEvents]);

  useEffect(() => {
    if (fetchedMessages) {
      setMessages(instanceId, fetchedMessages);
    }
  }, [fetchedMessages, instanceId, setMessages]);

  const displayAgent: SubAgentInstanceState | undefined =
    storeAgent ?? fetchedAgent ?? undefined;
  const parentThread = displayAgent?.parentThreadId
    ? agents.find((agent) => agent.instanceId === displayAgent.parentThreadId)
    : null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle bg-bg-elevated">
        {displayAgent?.parentThreadId ? (
          <button
            onClick={() => navigateToThread(displayAgent.parentThreadId ?? null)}
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            ← {parentThread?.kind === "main" ? "Main session" : parentThread?.description || "Parent thread"}
          </button>
        ) : (
          <button
            onClick={onBack}
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Lion
          </button>
        )}
        {displayAgent ? (
          <div className="flex items-center gap-2 min-w-0">
            <StatusBadge state={displayAgent.state} pulse={displayAgent.state === "running"} />
            <span className="text-sm font-medium text-text-primary truncate">
              {displayAgent.kind === "main" ? "Main agent" : displayAgent.description || displayAgent.definitionName}
            </span>
            <span className="text-xs text-text-muted shrink-0">
              {displayAgent.kind === "main" ? displayAgent.sessionId ?? "main" : displayAgent.taskId}
            </span>
          </div>
        ) : (
          <span className="text-sm text-text-muted">Loading...</span>
        )}
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        <ErrorBoundary threadId={instanceId}>
          <ChatView instanceId={instanceId} />
        </ErrorBoundary>
      </div>
    </div>
  );
}
