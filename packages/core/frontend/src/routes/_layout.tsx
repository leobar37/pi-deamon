import { createFileRoute, Outlet, useMatch } from "@tanstack/react-router";
import { DashboardLayout } from "../components/DashboardLayout.tsx";

export const Route = createFileRoute("/_layout")({
	component: LayoutRoute,
});

function LayoutRoute() {
	const threadMatch = useMatch({ from: "/_layout/thread/$threadId", shouldThrow: false });
	const activeThreadId = threadMatch?.params.threadId ?? null;
	const isEmbeddedThread =
		typeof window !== "undefined"
		&& (new URLSearchParams(window.location.search).get("canvas") === "1"
			|| new URLSearchParams(window.location.search).get("embed") === "1");

	if (isEmbeddedThread) {
		return <Outlet />;
	}

	return (
		<DashboardLayout activeThreadId={activeThreadId}>
			<Outlet />
		</DashboardLayout>
	);
}
