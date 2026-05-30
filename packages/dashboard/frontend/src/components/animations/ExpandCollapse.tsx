import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

interface ExpandCollapseProps {
	children: ReactNode;
	className?: string;
	isOpen: boolean;
}

const defaultTransition = {
	duration: 0.25,
	ease: [0.25, 0.1, 0.25, 1] as const,
};

export function ExpandCollapse({ children, className, isOpen }: ExpandCollapseProps) {
	return (
		<AnimatePresence initial={false}>
			{isOpen && (
				<motion.div
					initial={{ height: 0, opacity: 0 }}
					animate={{ height: "auto", opacity: 1 }}
					exit={{ height: 0, opacity: 0 }}
					transition={defaultTransition}
					className={className}
					style={{ overflow: "hidden" }}
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	);
}
