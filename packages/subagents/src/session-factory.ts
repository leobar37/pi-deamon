import {
	createAgentSession,
	DefaultResourceLoader,
	getAgentDir,
	SessionManager,
} from "@earendil-works/pi-coding-agent";
import { DEFAULT_BUILDER } from "./instructions/defaults.js";
import type {
	CreateSubAgentSessionOptions,
	CreateSubAgentSessionResult,
	EffectiveSubAgentConfig,
	InstructionBuilder,
	InstructionContext,
} from "./types.js";

function resolveBuilder(config: EffectiveSubAgentConfig): InstructionBuilder {
	return config.instructionBuilder ?? DEFAULT_BUILDER;
}

export function buildSubAgentInstructions(options: {
	config: EffectiveSubAgentConfig;
	task: CreateSubAgentSessionOptions["task"];
}): string {
	const builder = resolveBuilder(options.config);
	const ctx: InstructionContext = { task: options.task, config: options.config };
	return builder(ctx);
}

export async function createSubAgentSession(
	options: CreateSubAgentSessionOptions,
): Promise<CreateSubAgentSessionResult> {
	const cwd = options.cwd;
	const resourceCwd = options.resourceCwd;
	const agentDir = getAgentDir();

	const loader = new DefaultResourceLoader({
		cwd: resourceCwd,
		agentDir,
		settingsManager: options.settingsManager,
		additionalSkillPaths: options.config.skillPaths,
		extensionFactories: [
			(pi) => {
				// Tool restrictions
				pi.on("session_start", async () => {
					if (options.config.tools?.length) {
						pi.setActiveTools(options.config.tools);
					} else if (options.config.disabledTools?.length) {
						const all = pi.getAllTools().map((t) => t.name);
						pi.setActiveTools(all.filter((t) => !options.config.disabledTools!.includes(t)));
					}
				});

				// System prompt injection
				pi.on("before_agent_start", async (event) => {
					return {
						systemPrompt: `${event.systemPrompt}\n\n${options.config.systemPrompt}`,
					};
				});

				// Register custom extension factory from definition
				if (options.config.extensionFactory) {
					options.config.extensionFactory(pi);
				}
			},
		],
	});

	await loader.reload();

	const { session } = await createAgentSession({
		resourceLoader: loader,
		cwd,
		model: undefined, // TODO: resolve model from config.model string
		thinkingLevel: options.config.thinkingLevel,
		settingsManager: options.settingsManager,
		sessionManager: SessionManager.create(cwd),
		authStorage: options.authStorage,
		modelRegistry: options.modelRegistry,
	});

	return { session };
}
