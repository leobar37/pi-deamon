export function getHashThreadId(): string | null {
	const hash = window.location.hash;
	return hash.startsWith("#/thread/") ? decodeURIComponent(hash.slice("#/thread/".length)) : null;
}

export function navigateToThread(id: string | null): void {
	window.location.hash = id ? `#/thread/${encodeURIComponent(id)}` : "#/";
}
