import Link from "next/link";
import type { LinkProps } from "next/link";
import { ReactNode } from "react";

type ButtonVariant = "primary" | "soft" | "outline";

type CommonProps = {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
};

type ButtonAsButton = CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: never };
type ButtonAsLink = CommonProps & { href: LinkProps["href"] };
type ButtonProps = ButtonAsButton | ButtonAsLink;

function isLinkProps(p: ButtonProps): p is ButtonAsLink {
  return "href" in p && p.href !== undefined;
}

export function Button(props: ButtonProps) {
  const base =
    "inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold ring-1 transition will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-[0.99]";

  const variant: ButtonVariant = props.variant ?? "primary";
  const variantClass =
    variant === "primary"
      ? "bg-white text-black ring-white/10 shadow-[0_18px_60px_rgba(56,189,248,0.12)] hover:bg-white/95"
      : variant === "soft"
        ? "bg-white/10 text-white ring-white/15 hover:bg-white/15"
        : "bg-transparent text-white/75 ring-white/10 hover:bg-white/5";

  const cls = [base, variantClass, props.className ?? ""].join(" ");

  if (isLinkProps(props)) {
    return (
      <Link href={props.href} className={cls}>
        {props.children}
      </Link>
    );
  }

  const { children, className, ...rest } = props;
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

