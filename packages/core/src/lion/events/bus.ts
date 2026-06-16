import { EventBusBase } from "../../event-bus.js";
import type { LionEvent, LionEventMap, LionEventType } from "../types.js";

export class LionRuntimeEventBus extends EventBusBase<LionEvent, LionEventType> {
	on<T extends LionEventType>(type: T, listener: (event: LionEventMap[T]) => void): () => void;
	on(type: "*", listener: (event: LionEvent) => void): () => void;
	on(type: LionEventType | "*", listener: (event: LionEvent) => void): () => void {
		return super.on(type, listener);
	}
}
