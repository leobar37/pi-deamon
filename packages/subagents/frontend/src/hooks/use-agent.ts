import { useQuery } from "@tanstack/react-query";
import { fetchAgent } from "../api.ts";

export function useAgent(instanceId: string) {
	return useQuery({
		queryKey: ["agent", instanceId],
		queryFn: () => fetchAgent(instanceId),
		enabled: !!instanceId,
	});
}
