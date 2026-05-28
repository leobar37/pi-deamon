import { useQuery } from "@tanstack/react-query";
import { fetchAgentMessages } from "../api.ts";

export function useAgentMessages(instanceId: string) {
	return useQuery({
		queryKey: ["agent-messages", instanceId],
		queryFn: () => fetchAgentMessages(instanceId),
		enabled: !!instanceId,
	});
}
