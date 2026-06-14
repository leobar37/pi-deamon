import type { subagentsContract } from "@local/pi-subagents/contract";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";

export type SubagentsClient = ContractRouterClient<typeof subagentsContract>;

export function createSubagentsClient(backendUrl: string): SubagentsClient {
	const rpcUrl = new URL("/rpc", backendUrl).toString();
	const link = new RPCLink({ url: rpcUrl });
	return createORPCClient(link);
}
