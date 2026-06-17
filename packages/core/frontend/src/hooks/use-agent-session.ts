import { skipToken, useQuery } from "@tanstack/react-query";
import { api } from "../api/client.ts";
import { convertAgentMessages } from "../utils/message-converter.ts";

export function useAgentSession(instanceId: string) {
  return useQuery({
    ...api.threads.session.queryOptions({
      input: instanceId ? { threadId: instanceId } : skipToken,
    }),
    select: (data) => ({
      sessionId: data.sessionId,
      version: data.version,
      entries: data.entries,
      leafId: data.leafId,
      messages: convertAgentMessages(instanceId, data.messages as Array<Record<string, unknown>>),
      settings: data.settings,
      compactions: data.compactions,
    }),
  });
}
