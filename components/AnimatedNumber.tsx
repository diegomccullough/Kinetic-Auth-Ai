"use client";

import { animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export type AnimatedNumberProps = {
  value: number;
  className?: string;
  duration?: number;
  format?: (n: number) => string;
};

export default function AnimatedNumber({ value, className, duration = 0.55, format }: AnimatedNumberProps) {
  const fromRef = useRef(value);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const from = fromRef.current;
    const controls = animate(from, value, {
      duration,
      ease: [0.2, 0.9, 0.2, 1],
      onUpdate: (latest) => setDisplay(latest)
    });
    fromRef.current = value;
    return () => controls.stop();
  }, [duration, value]);

  return <span className={className}>{format ? format(display) : String(Math.round(display))}</span>;
}

