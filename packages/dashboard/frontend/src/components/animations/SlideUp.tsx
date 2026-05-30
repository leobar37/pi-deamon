import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface SlideUpProps {
	children: ReactNode;
	className?: string;
	delay?: number;
	duration?: number;
	distance?: number;
}

const defaultTransition = {
	duration: 0.3,
	ease: [0.25, 0.1, 0.25, 1] as const,
};

export function SlideUp({ children, className, delay = 0, duration = 0.3, distance = 12 }: SlideUpProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: distance }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: distance }}
			transition={{ ...defaultTransition, delay, duration }}
			className={className}
		>
			{children}
		</motion.div>
	);
}
