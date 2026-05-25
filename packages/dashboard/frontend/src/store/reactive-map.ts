import { atom } from "jotai";
import type { Atom, WritableAtom } from "jotai";

export type MapAction<K, V> =
	| { type: "set"; key: K; value: V }
	| { type: "delete"; key: K }
	| { type: "clear" }
	| { type: "batch"; entries: Iterable<[K, V]> };

export interface ReactiveMapAtoms<K, V> {
	mapAtom: WritableAtom<Map<K, V>, [MapAction<K, V>], void>;
	sizeAtom: Atom<number>;
	keysAtom: Atom<K[]>;
	entriesAtom: Atom<[K, V][]>;
	atomFor: (key: K) => Atom<V | undefined>;
}

export function createReactiveMap<K, V>(initialEntries?: Iterable<[K, V]>): ReactiveMapAtoms<K, V> {
	const baseAtom = atom<{ map: Map<K, V>; version: number }>({
		map: new Map(initialEntries),
		version: 0,
	});

	const mapAtom = atom(
		(get) => get(baseAtom).map,
		(_get, set, action: MapAction<K, V>) => {
			set(baseAtom, (prev) => {
				const newMap = new Map(prev.map);
				switch (action.type) {
					case "set":
						newMap.set(action.key, action.value);
						break;
					case "delete":
						newMap.delete(action.key);
						break;
					case "clear":
						newMap.clear();
						break;
					case "batch":
						for (const [k, v] of action.entries) newMap.set(k, v);
						break;
				}
				return { map: newMap, version: prev.version + 1 };
			});
		},
	);

	const sizeAtom = atom((get) => get(mapAtom).size);
	const keysAtom = atom((get) => Array.from(get(mapAtom).keys()));
	const entriesAtom = atom((get) => Array.from(get(mapAtom).entries()));

	const atomCache = new Map<K, Atom<V | undefined>>();
	const atomFor = (key: K): Atom<V | undefined> => {
		const cached = atomCache.get(key);
		if (cached) return cached;
		const a = atom((get) => get(mapAtom).get(key));
		atomCache.set(key, a);
		return a;
	};

	return { mapAtom, sizeAtom, keysAtom, entriesAtom, atomFor };
}
