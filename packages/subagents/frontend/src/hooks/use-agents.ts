import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.ts";

export interface UseAgentsInput {
	parentThreadId?: string;
	parentToolCallId?: string;
	runId?: string;
	includeHistory?: boolean;
}

export function useAgents(input?: UseAgentsInput) {
	return useQuery(api.threads.list.queryOptions(input));
}
