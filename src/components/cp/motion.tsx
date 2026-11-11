"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from "motion/react";

const ease = [0.22, 1, 0.36, 1] as const;

export function FadeIn({
  children,
  delay = 0,
  y = 10,
  className,
  ...props
}: { children: ReactNode; delay?: number; y?: number } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease } },
};

export function Stagger({
  children,
  className,
  inView = false,
  ...props
}: { children: ReactNode; inView?: boolean } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      {...(inView
        ? { whileInView: "show", viewport: { once: true, margin: "-60px" } }
        : { animate: "show" })}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  ...props
}: { children: ReactNode } & HTMLMotionProps<"div">) {
  return (
    <motion.div variants={item} className={className} {...props}>
      {children}
    </motion.div>
  );
}

/** Counts up from 0 to `value` the first time it scrolls into view. */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString("en-NG"),
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const unsubscribe = motionValue.on("change", (latest) => {
      node.textContent = format(latest);
    });
    return unsubscribe;
  }, [motionValue, format]);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      motionValue.set(value);
      if (ref.current) ref.current.textContent = format(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 1.1, ease });
    return () => controls.stop();
  }, [inView, value, reduce, motionValue, format]);

  return (
    <span ref={ref} className={className}>
      {format(reduce ? value : 0)}
    </span>
  );
}
