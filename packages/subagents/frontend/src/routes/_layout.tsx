import { createFileRoute, Outlet, useMatch } from "@tanstack/react-router";
import { DashboardLayout } from "../components/DashboardLayout.tsx";

export const Route = createFileRoute("/_layout")({
	component: LayoutRoute,
});

function LayoutRoute() {
	const threadMatch = useMatch({ from: "/_layout/thread/$threadId", shouldThrow: false });
	const activeThreadId = threadMatch?.params.threadId ?? null;
	const isCanvasPreview =
		typeof window !== "undefined" && new URLSearchParams(window.location.search).get("canvas") === "1";

	if (isCanvasPreview) {
		return <Outlet />;
	}

	return (
		<DashboardLayout activeThreadId={activeThreadId}>
			<Outlet />
		</DashboardLayout>
	);
}
