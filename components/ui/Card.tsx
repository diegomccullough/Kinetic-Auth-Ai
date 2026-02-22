import { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-[28px] bg-white/[0.04] ring-1 ring-white/10",
        className ?? ""
      ].join(" ")}
    >
      {children}
    </div>
  );
}

