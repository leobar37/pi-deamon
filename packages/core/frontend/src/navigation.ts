import { router } from "./router.tsx";

export type ThreadRouteVariant = "full" | "canvas" | "embed";

export function navigateToThread(id: string | null, variant: ThreadRouteVariant = "full"): void {
	if (id) {
		void router.navigate({
			to: "/thread/$threadId",
			params: { threadId: id },
			search: variant === "canvas" ? { canvas: "1" } : variant === "embed" ? { embed: "1" } : {},
		});
	} else {
		void router.navigate({ to: "/" });
	}
}
