export function buildRefinePrompt(todoId: string, title: string): string {
	return (
		`let's refine task ${todoId} "${title}": ` +
		"Ask me for the missing details needed to refine the todo together. Do not rewrite the todo yet and do not make assumptions. " +
		"Ask clear, concrete questions and wait for my answers before drafting any structured description.\n\n"
	);
}
