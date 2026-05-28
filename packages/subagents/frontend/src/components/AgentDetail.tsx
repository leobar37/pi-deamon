import { useEffect } from "react";
import type { SubAgentEvent, SubAgentInstanceState } from "../types.ts";
import { useAgent } from "../hooks/use-agent.ts";
import { useAgentEvents } from "../hooks/use-agent-events.ts";
import { useAgentMessages } from "../hooks/use-agent-messages.ts";
import { ChatView } from "./ChatView.tsx";
import { StatusBadge } from "./StatusBadge.tsx";
import { useSubAgentStore } from "../store/use-subagent-store.ts";
import { useSessionMessagesStore } from "../store/session-messages.ts";

interface AgentDetailProps {
  instanceId: string;
  onBack: () => void;
}

function elapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  return `${m}m${Math.floor(s % 60).toString().padStart(2, "0")}s`;
}

export function AgentDetail({ instanceId, onBack }: AgentDetailProps) {
  const { data: fetchedAgent } = useAgent(instanceId);
  const { data: fetchedEvents } = useAgentEvents(instanceId);
  const { data: fetchedMessages } = useAgentMessages(instanceId);

  const setMessages = useSessionMessagesStore((s) => s.setMessages);
  const setEvents = useSubAgentStore((s) => s.setEvents);
  const agents = useSubAgentStore((s) => s.agents);

  const storeAgent = agents.find((a) => a.instanceId === instanceId);

  // Sync TanStack Query data into zustand stores on mount / change
  useEffect(() => {
    if (fetchedEvents) {
      setEvents(fetchedEvents as SubAgentEvent[]);
    }
  }, [fetchedEvents, setEvents]);

  useEffect(() => {
    if (fetchedMessages) {
      setMessages(instanceId, fetchedMessages);
    }
  }, [fetchedMessages, instanceId, setMessages]);

  const displayAgent: SubAgentInstanceState | undefined =
    storeAgent ?? fetchedAgent ?? undefined;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle bg-bg-elevated">
        <button
          onClick={onBack}
          className="text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          ← Back
        </button>
        {displayAgent ? (
          <div className="flex items-center gap-2 min-w-0">
            <StatusBadge state={displayAgent.state} pulse={displayAgent.state === "running"} />
            <span className="text-sm font-medium text-text-primary truncate">
              {displayAgent.description || displayAgent.definitionName}
            </span>
            <span className="text-xs text-text-muted shrink-0">
              {displayAgent.taskId}
            </span>
          </div>
        ) : (
          <span className="text-sm text-text-muted">Loading...</span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Info panel */}
        <div className="w-64 border-r border-border-subtle bg-bg-elevated p-4 space-y-4 overflow-y-auto shrink-0">
          {displayAgent ? (
            <>
              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider">State</div>
                <div className="text-sm text-text-primary mt-1">{displayAgent.state}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider">Instance ID</div>
                <div className="text-sm text-text-primary mt-1 font-mono break-all">{displayAgent.instanceId}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider">Task ID</div>
                <div className="text-sm text-text-primary mt-1 font-mono">{displayAgent.taskId}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider">Description</div>
                <div className="text-sm text-text-primary mt-1">{displayAgent.description || displayAgent.definitionName}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider">Definition</div>
                <div className="text-sm text-text-primary mt-1">{displayAgent.definitionName}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider">Turns</div>
                <div className="text-sm text-text-primary mt-1">{displayAgent.turnCount}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider">Tools</div>
                <div className="text-sm text-text-primary mt-1">{displayAgent.toolCount}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider">Duration</div>
                <div className="text-sm text-text-primary mt-1">{elapsed(displayAgent.durationMs)}</div>
              </div>
              {displayAgent.currentTool ? (
                <div>
                  <div className="text-xs text-text-muted uppercase tracking-wider">Current Tool</div>
                  <div className="text-sm text-accent mt-1">{displayAgent.currentTool}</div>
                </div>
              ) : null}
              {displayAgent.error ? (
                <div>
                  <div className="text-xs text-text-muted uppercase tracking-wider">Error</div>
                  <div className="text-sm text-error mt-1">{displayAgent.error}</div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-sm text-text-muted">Loading agent info...</div>
          )}
        </div>

        {/* Chat panel */}
        <div className="flex-1 min-w-0">
          <ChatView instanceId={instanceId} />
        </div>
      </div>
    </div>
  );
}
