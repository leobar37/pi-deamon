import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, orpc } from "../api/client.ts";
import { useSubAgentStore } from "../store/use-subagent-store.ts";

export function useThreadModels(instanceId: string) {
	return useQuery(
		api.threads.models.queryOptions({
			input: instanceId ? { threadId: instanceId } : skipToken,
		}),
	);
}

export function useSelectThreadModel() {
	const queryClient = useQueryClient();
	const updateAgent = useSubAgentStore((state) => state.updateAgent);

	return useMutation({
		mutationFn: (input: { threadId: string; provider: string; modelId: string }) => orpc.threads.model(input),
		onSuccess: (result) => {
			const current = useSubAgentStore.getState().agents.find((agent) => agent.instanceId === result.threadId);
			if (current) {
				updateAgent({ ...current, modelProvider: result.provider, modelId: result.modelId, lastActivityAt: Date.now() });
			}
			queryClient.invalidateQueries({ queryKey: ["agents"] });
			queryClient.invalidateQueries({ queryKey: ["agent", result.threadId] });
		},
	});
}
