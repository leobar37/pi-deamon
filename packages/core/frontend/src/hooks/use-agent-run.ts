import { skipToken, useQuery } from "@tanstack/react-query";
import { api } from "../api/client.ts";

export function useAgentRun(instanceId: string) {
	return useQuery({
		...api.threads.run.queryOptions({
			input: instanceId ? { threadId: instanceId } : skipToken,
		}),
		retry: false,
		select: (data) => data ?? undefined,
	});
}
