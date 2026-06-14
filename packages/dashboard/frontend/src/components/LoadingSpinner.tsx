interface LoadingSpinnerProps {
	size?: "sm" | "md";
	className?: string;
}

export function LoadingSpinner({ size = "md", className = "" }: LoadingSpinnerProps) {
	const sizeClasses = size === "sm" ? "h-4 w-4" : "h-5 w-5";
	return (
		<span
			className={`inline-block ${sizeClasses} animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
			aria-hidden="true"
		/>
	);
}
