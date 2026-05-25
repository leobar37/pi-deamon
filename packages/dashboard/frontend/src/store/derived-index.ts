import { atom } from "jotai";
import type { Atom } from "jotai";

export interface DerivedIndexAtoms<K, V, G> {
	indexAtom: Atom<Map<G, K[]>>;
	groupKeysAtom: Atom<G[]>;
	atomFor: (groupKey: G) => Atom<K[]>;
	groupCountAtom: Atom<number>;
}

export function createDerivedIndex<K, V, G>(
	sourceAtom: Atom<Map<K, V>>,
	groupBy: (value: V, key: K) => G,
): DerivedIndexAtoms<K, V, G> {
	const indexAtom = atom((get) => {
		const source = get(sourceAtom);
		const index = new Map<G, K[]>();
		for (const [key, value] of source) {
			const group = groupBy(value, key);
			// Skip entries with empty/undefined group keys
			if (group === undefined || group === null || group === "") continue;
			const ids = index.get(group);
			if (ids) ids.push(key);
			else index.set(group, [key]);
		}
		return index;
	});

	const groupKeysAtom = atom((get) => Array.from(get(indexAtom).keys()));
	const groupCountAtom = atom((get) => get(indexAtom).size);

	const atomCache = new Map<G, Atom<K[]>>();
	const atomFor = (groupKey: G): Atom<K[]> => {
		const cached = atomCache.get(groupKey);
		if (cached) return cached;
		const a = atom((get) => get(indexAtom).get(groupKey) ?? []);
		atomCache.set(groupKey, a);
		return a;
	};

	return { indexAtom, groupKeysAtom, atomFor, groupCountAtom };
}
