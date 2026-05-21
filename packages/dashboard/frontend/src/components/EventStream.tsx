import { useEffect, useRef } from "react";
import { consumeEventIterator } from "@orpc/client";
import { orpc } from "../orpc.js";
import { useDashboardStore } from "../store/dashboard.js";

export function EventStream() {
	const addEvent = useDashboardStore((s) => s.addEvent);
	const setConnected = useDashboardStore((s) => s.setConnected);
	const connectedRef = useRef(false);

	useEffect(() => {
		let cancelled = false;
		let cancelFn: (() => Promise<void>) | null = null;

		async function connect() {
			if (cancelled) return;
			try {
				const stream = await orpc.dashboard.events.stream();
				connectedRef.current = true;
				setConnected(true);

				cancelFn = consumeEventIterator(stream, {
					onEvent: (event) => {
						addEvent(event);
					},
					onError: () => {
						connectedRef.current = false;
						setConnected(false);
					},
					onFinish: () => {
						connectedRef.current = false;
						setConnected(false);
						cancelFn = null;
						// Reconnect after a short delay
						setTimeout(connect, 1000);
					},
				});
			} catch {
				connectedRef.current = false;
				setConnected(false);
				// Retry after delay
				setTimeout(connect, 3000);
			}
		}

		connect();

		return () => {
			cancelled = true;
			if (cancelFn) {
				void cancelFn();
			}
		};
	}, [addEvent, setConnected]);

	return null;
}
