let messageCounter = 0;

export function generateMessageId(): string {
	return `msg-${Date.now()}-${++messageCounter}`;
}
