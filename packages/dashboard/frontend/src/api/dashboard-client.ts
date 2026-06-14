import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { dashboardContract } from "@local/pi-dashboard/contract";
import type { ContractRouterClient } from "@orpc/contract";

export type DashboardClient = ContractRouterClient<typeof dashboardContract>;

export function createDashboardClient(baseUrl: string): DashboardClient {
	const rpcUrl = new URL("/rpc", baseUrl).toString();
	const link = new RPCLink({ url: rpcUrl });
	return createORPCClient(link) as DashboardClient;
}
