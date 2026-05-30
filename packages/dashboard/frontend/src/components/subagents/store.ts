import { atom } from "jotai";
import type { SubAgentInstanceState, SubAgentEvent } from "../../store/message-blocks.js";

/** All subagent instances tracked in the dashboard. */
export const subagentInstancesAtom = atom<SubAgentInstanceState[]>([]);

/** All subagent events tracked in the dashboard. */
export const subagentEventsAtom = atom<SubAgentEvent[]>([]);

/** Derived atom: map of instanceId -> instance. */
export const subagentByIdAtom = atom((get) => {
	const instances = get(subagentInstancesAtom);
	const map = new Map<string, SubAgentInstanceState>();
	for (const inst of instances) {
		map.set(inst.instanceId, inst);
	}
	return map;
});

/** Derived atom: root instances (those without a parentThreadId). */
export const subagentRootsAtom = atom((get) => {
	const instances = get(subagentInstancesAtom);
	return instances.filter((inst) => !inst.parentThreadId);
});

/** Get children of a given parent instanceId. */
export function useSubagentChildren(instances: SubAgentInstanceState[], parentId: string): SubAgentInstanceState[] {
	return instances.filter((inst) => inst.parentThreadId === parentId);
}
