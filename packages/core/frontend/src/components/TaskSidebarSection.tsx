import { Ban, Check, Circle, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
	groupTasks,
	useBlockTask,
	useCompleteTask,
	useCreateTask,
	useDeleteTask,
	useTasks,
	useUpdateTask,
} from "../hooks/use-tasks.ts";
import { getTaskListQueryKey } from "../lib/task-query-cache.ts";
import type { TaskRecord } from "../types.ts";

interface TaskSidebarSectionProps {
	sessionId?: string;
	tasksOverride?: TaskRecord[];
	compact?: boolean;
}

export function TaskSidebarSection({ sessionId, tasksOverride, compact = false }: TaskSidebarSectionProps) {
	const queryClient = useQueryClient();
	const { data, isLoading } = useTasks({ enabled: tasksOverride === undefined, refetchInterval: 15000 });
	const createTask = useCreateTask();
	const updateTask = useUpdateTask();
	const completeTask = useCompleteTask();
	const blockTask = useBlockTask();
	const deleteTask = useDeleteTask();
	const [title, setTitle] = useState("");
	const [notes, setNotes] = useState("");
	const [error, setError] = useState<string | null>(null);
	const tasks = tasksOverride ?? data ?? [];
	const grouped = useMemo(() => groupTasks(tasks), [tasks]);
	const progress = useMemo(() => getTaskProgress(tasks), [tasks]);
	const isMutating =
		createTask.isPending || updateTask.isPending || completeTask.isPending || blockTask.isPending || deleteTask.isPending;
	const canMutate = tasksOverride === undefined;

	function syncTask(task: TaskRecord): void {
		setTaskInCache(queryClient, task);
	}

	function reportError(error: unknown): void {
		setError(error instanceof Error ? error.message : String(error));
	}

	const submitTask = () => {
		setError(null);
		const trimmedTitle = title.trim();
		const trimmedNotes = notes.trim();
		if (!trimmedTitle || !canMutate) return;
		createTask.mutate(
			{
				title: trimmedTitle,
				actorSessionId: sessionId,
				context: trimmedNotes ? { notes: trimmedNotes } : undefined,
			},
			{
				onSuccess: (result) => {
					syncTask(result.task);
					setTitle("");
					setNotes("");
				},
				onError: reportError,
			},
		);
	};

	return (
		<section className={`flex min-h-0 flex-col rounded border border-border-subtle bg-bg ${compact ? "px-2 py-2" : "px-2.5 py-2.5 sm:px-3 sm:py-3"}`}>
			<div className={`flex items-center justify-between gap-3 ${compact ? "mb-1.5" : "mb-2 sm:mb-3"}`}>
				<h2 className={compact ? "text-[11px] font-semibold uppercase text-text-tertiary" : "text-xs font-semibold uppercase tracking-wide text-text-tertiary"}>Tasks</h2>
				<div className="text-[11px] text-text-muted">{tasks.length}</div>
			</div>

			<div className="space-y-1.5 sm:space-y-2">
				<input
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.shiftKey) {
							event.preventDefault();
							submitTask();
						}
					}}
					placeholder="Task"
					className="w-full rounded border border-border-subtle bg-bg-elevated px-2 py-1.5 text-xs text-text-primary outline-none transition placeholder:text-text-muted focus:border-border-hover"
				/>
				<textarea
					value={notes}
					onChange={(event) => setNotes(event.target.value)}
					placeholder="Context"
					rows={compact ? 1 : 2}
					className="max-h-24 min-h-10 w-full resize-y rounded border border-border-subtle bg-bg-elevated px-2 py-1.5 text-xs text-text-primary outline-none transition placeholder:text-text-muted focus:border-border-hover"
				/>
				<button
					type="button"
					onClick={submitTask}
					disabled={!title.trim() || isMutating || !canMutate}
					title="Create task"
					className="inline-flex h-7 w-full items-center justify-center gap-1.5 rounded border border-border-subtle bg-bg-surface px-2 text-xs font-medium text-text-primary transition hover:border-border-hover disabled:cursor-not-allowed disabled:opacity-50"
				>
					<Plus className="h-3.5 w-3.5" />
					Add
				</button>
				{error ? (
					<div className="rounded border border-error/30 bg-error/10 px-2 py-1.5 text-[11px] leading-snug text-error">
						{error}
					</div>
				) : null}
			</div>

			<div className={compact ? "mt-2" : "mt-3"}>
				<div className="flex items-center justify-between gap-2 text-[11px] text-text-muted">
					<span>
						{progress.completed}/{progress.total} complete
					</span>
					<span>{progress.percent}%</span>
				</div>
				<div className="mt-1 h-1.5 overflow-hidden rounded bg-bg-surface">
					<div className="h-full bg-success transition-[width]" style={{ width: `${progress.percent}%` }} />
				</div>
			</div>

			<div className={compact ? "mt-2 min-h-0 space-y-1.5 overflow-y-auto pr-1" : "mt-3 min-h-0 space-y-2.5 overflow-y-auto pr-1 sm:mt-4 sm:space-y-3"}>
				{isLoading && tasks.length === 0 ? <div className="text-xs text-text-muted">Loading tasks...</div> : null}
				<TaskGroup
					title="Active"
					tasks={grouped.active}
					empty="No active task"
					compact={compact}
					actions={(task) => (
						<>
							<TaskIconButton
								title="Complete"
								compact={compact}
								disabled={isMutating}
								onClick={() => {
									setError(null);
									completeTask.mutate(
										{ id: task.id, actorSessionId: sessionId, expectedRevision: task.revision },
										{ onSuccess: (result) => syncTask(result.task), onError: reportError },
									);
								}}
							>
								<Check className="h-3.5 w-3.5" />
							</TaskIconButton>
							<TaskIconButton
								title="Block"
								compact={compact}
								disabled={isMutating}
								onClick={() => {
									setError(null);
									blockTaskFromPrompt((input) => blockTask.mutate(input, { onSuccess: (result) => syncTask(result.task), onError: reportError }), task, sessionId);
								}}
							>
								<Ban className="h-3.5 w-3.5" />
							</TaskIconButton>
						</>
					)}
				/>
				<TaskGroup
					title="Pending"
					tasks={grouped.pending}
					empty="No pending task"
					compact={compact}
					actions={(task) => (
						<>
							<TaskIconButton
								title="Start"
								compact={compact}
								disabled={isMutating || !sessionId}
								onClick={() => {
									setError(null);
									updateTask.mutate({
										id: task.id,
										status: "in_progress",
										assignedToSession: sessionId,
										actorSessionId: sessionId,
										expectedRevision: task.revision,
									}, { onSuccess: (result) => syncTask(result.task), onError: reportError });
								}}
							>
								<Play className="h-3.5 w-3.5" />
							</TaskIconButton>
							<TaskIconButton
								title="Complete"
								compact={compact}
								disabled={isMutating}
								onClick={() => {
									setError(null);
									completeTask.mutate(
										{ id: task.id, actorSessionId: sessionId, expectedRevision: task.revision },
										{ onSuccess: (result) => syncTask(result.task), onError: reportError },
									);
								}}
							>
								<Check className="h-3.5 w-3.5" />
							</TaskIconButton>
						</>
					)}
				/>
				<TaskGroup
					title="Blocked"
					tasks={grouped.blocked}
					empty="No blocked task"
					compact={compact}
					actions={(task) => (
						<TaskIconButton
							title="Reopen"
							compact={compact}
							disabled={isMutating}
							onClick={() => {
								setError(null);
								updateTask.mutate({
									id: task.id,
									status: "pending",
									assignedToSession: null,
									actorSessionId: sessionId,
									expectedRevision: task.revision,
								}, { onSuccess: (result) => syncTask(result.task), onError: reportError });
							}}
						>
							<RotateCcw className="h-3.5 w-3.5" />
						</TaskIconButton>
					)}
				/>
				<TaskGroup
					title="Done"
					tasks={grouped.completed.slice(0, 4)}
					empty="No completed task"
					compact={compact}
					actions={(task) => (
						<TaskIconButton
							title="Delete"
							compact={compact}
							disabled={isMutating}
							onClick={() => {
								setError(null);
								deleteTask.mutate(
									{ id: task.id, actorSessionId: sessionId, expectedRevision: task.revision },
									{ onSuccess: (result) => syncTask(result.task), onError: reportError },
								);
							}}
						>
							<Trash2 className="h-3.5 w-3.5" />
						</TaskIconButton>
					)}
				/>
			</div>
		</section>
	);
}

interface TaskGroupProps {
	title: string;
	tasks: TaskRecord[];
	empty: string;
	compact?: boolean;
	actions(task: TaskRecord): ReactNode;
}

function TaskGroup({ title, tasks, empty, compact = false, actions }: TaskGroupProps) {
	return (
		<div>
			<div className={`flex items-center justify-between gap-2 uppercase text-text-tertiary ${compact ? "mb-1 text-[10px]" : "mb-1.5 text-[11px] tracking-wide"}`}>
				<span>{title}</span>
				<span>{tasks.length}</span>
			</div>
			{tasks.length === 0 ? (
				<div className={`rounded border border-border-subtle bg-bg-elevated text-text-muted ${compact ? "px-1.5 py-1 text-[11px]" : "px-2 py-1.5 text-xs"}`}>
					{empty}
				</div>
			) : (
				<div className={compact ? "space-y-1" : "space-y-1.5"}>
					{tasks.map((task) => (
						<div key={task.id} className={`rounded border border-border-subtle bg-bg-elevated ${compact ? "px-1.5 py-1" : "px-2 py-1.5 sm:py-2"}`}>
							<div className={compact ? "flex items-center gap-1.5" : "flex items-start gap-2"}>
								{compact ? null : <Circle className="mt-0.5 hidden h-3.5 w-3.5 shrink-0 text-text-muted sm:block" />}
								<div className="min-w-0 flex-1">
									<div className={`${compact ? "text-[11px]" : "text-xs"} truncate font-medium text-text-primary`} title={task.title}>
										{task.title}
									</div>
									{!compact && task.context?.notes ? (
										<div className="mt-1 hidden text-[11px] leading-snug text-text-muted sm:line-clamp-2">{task.context.notes}</div>
									) : null}
								</div>
								<div className="flex shrink-0 items-center gap-1">{actions(task)}</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function TaskIconButton({
	title,
	compact = false,
	disabled,
	onClick,
	children,
}: {
	title: string;
	compact?: boolean;
	disabled?: boolean;
	onClick(): void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			title={title}
			aria-label={title}
			disabled={disabled}
			onClick={onClick}
			className={`${compact ? "h-5 w-5 [&_svg]:h-3 [&_svg]:w-3" : "h-5 w-5 sm:h-6 sm:w-6"} inline-flex items-center justify-center rounded border border-border-subtle text-text-secondary transition hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40`}
		>
			{children}
		</button>
	);
}

function getTaskProgress(tasks: TaskRecord[]): { completed: number; total: number; percent: number } {
	const visible = tasks.filter((task) => task.status !== "deleted");
	const total = visible.length;
	const completed = visible.filter((task) => task.status === "completed").length;
	const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
	return { completed, total, percent };
}

function setTaskInCache(queryClient: QueryClient, task: TaskRecord): void {
	for (const includeDeleted of [false, true]) {
		queryClient.setQueryData<TaskRecord[]>(getTaskListQueryKey(includeDeleted), (current) => {
			const existing = current ?? [];
			if (!includeDeleted && task.status === "deleted") {
				return existing.filter((item) => item.id !== task.id);
			}
			const index = existing.findIndex((item) => item.id === task.id);
			if (index === -1) return sortTasks([...existing, task]);
			const next = [...existing];
			next[index] = task;
			return sortTasks(next);
		});
	}
}

function sortTasks(tasks: TaskRecord[]): TaskRecord[] {
	return [...tasks].sort((a, b) => {
		const statusDelta = statusRank(a.status) - statusRank(b.status);
		if (statusDelta !== 0) return statusDelta;
		return b.updatedAt.localeCompare(a.updatedAt);
	});
}

function statusRank(status: TaskRecord["status"]): number {
	switch (status) {
		case "in_progress":
			return 0;
		case "pending":
			return 1;
		case "blocked":
			return 2;
		case "completed":
			return 3;
		case "deleted":
			return 4;
	}
}

function blockTaskFromPrompt(
	mutate: (input: { id: string; reason: string; actorSessionId?: string; expectedRevision?: number }) => void,
	task: TaskRecord,
	actorSessionId?: string,
): void {
	const reason = window.prompt("Block reason");
	if (!reason?.trim()) return;
	mutate({ id: task.id, reason: reason.trim(), actorSessionId, expectedRevision: task.revision });
}
