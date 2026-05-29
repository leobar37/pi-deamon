import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { useSubAgentStore } from "../store/use-subagent-store.ts";
import { useSessionMessagesStore } from "../store/session-messages.ts";
import { useAutoScroll } from "../hooks/use-auto-scroll.ts";
import { MessageItem } from "./MessageItem.tsx";

interface ChatViewProps {
  instanceId: string;
}

export function ChatView({ instanceId }: ChatViewProps) {
  const isConnected = useSubAgentStore((s) => s.isConnected);
  const thread = useSubAgentStore((s) => s.agents.find((agent) => agent.instanceId === instanceId));
  const messagesByInstance = useSessionMessagesStore((s) => s.messagesByInstance);
  const streamingByInstance = useSessionMessagesStore((s) => s.streamingByInstance);
  const messages = useMemo(() => messagesByInstance.get(instanceId) ?? [], [messagesByInstance, instanceId]);
  const streaming = useMemo(() => streamingByInstance.get(instanceId) ?? false, [streamingByInstance, instanceId]);
  const dependencyKey = `${instanceId}:${messages.length}:${streaming ? "streaming" : "idle"}`;
  const { scrollRef, bottomRef, showJumpToLatest, scrollToBottom } = useAutoScroll<HTMLDivElement>({
    dependencyKey,
    threadId: instanceId,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-bg-elevated">
        <span className="text-sm font-medium text-text-primary">
          {thread?.kind === "main" ? "Main Session" : "Live Session"}
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${isConnected ? "bg-success" : "bg-error"}`}
          />
          <span className="text-xs text-text-muted">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto p-4 space-y-4"
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-sm text-text-muted">
                Waiting for messages...
              </span>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  <MessageItem message={msg} />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          {streaming && (
            <motion.div
              className="flex justify-start"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
            >
              <div className="bg-bg-elevated rounded-lg px-4 py-2">
                <span className="text-sm text-text-muted animate-pulse">...</span>
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>
        {showJumpToLatest && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-border-default bg-bg-elevated px-3 py-1.5 text-xs text-text-secondary shadow-md hover:text-text-primary"
          >
            Jump to latest
          </button>
        )}
      </div>
    </div>
  );
}
