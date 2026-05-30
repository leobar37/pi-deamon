import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface FadeInProps {
	children: ReactNode;
	className?: string;
	delay?: number;
	duration?: number;
}

const defaultTransition = {
	duration: 0.25,
	ease: [0.25, 0.1, 0.25, 1] as const,
};

export function FadeIn({ children, className, delay = 0, duration = 0.25 }: FadeInProps) {
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ ...defaultTransition, delay, duration }}
			className={className}
		>
			{children}
		</motion.div>
	);
}
