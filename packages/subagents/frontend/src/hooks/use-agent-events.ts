import { useQuery } from "@tanstack/react-query";
import { fetchAgentEvents } from "../api.ts";

export function useAgentEvents(instanceId: string) {
	return useQuery({
		queryKey: ["agent-events", instanceId],
		queryFn: () => fetchAgentEvents(instanceId),
		enabled: !!instanceId,
	});
}
