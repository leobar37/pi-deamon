import { useQuery } from "@tanstack/react-query";
import { fetchAgentRun } from "../api.ts";

export function useAgentRun(instanceId: string) {
	return useQuery({
		queryKey: ["agent-run", instanceId],
		queryFn: () => fetchAgentRun(instanceId),
		enabled: !!instanceId,
		retry: false,
	});
}
