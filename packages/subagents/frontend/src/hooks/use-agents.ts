import { useQuery } from "@tanstack/react-query";
import { fetchAgents } from "../api.ts";

export function useAgents() {
	return useQuery({
		queryKey: ["agents"],
		queryFn: fetchAgents,
	});
}
