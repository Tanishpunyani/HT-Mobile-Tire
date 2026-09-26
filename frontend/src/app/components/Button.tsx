import Link from "next/link";
import { ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary";
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  disabled?: boolean;
};

export default function Button({
  children,
  href,
  variant = "primary",
  type = "button",
  onClick,
  disabled = false,
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center rounded-[10px] px-5 py-3 text-sm font-semibold transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";

  const variantStyles =
  variant === "primary"
    ? "bg-primary text-white shadow-md shadow-primary/25 hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-lg"
    : "border border-primary bg-transparent text-primary hover:bg-primary hover:text-white hover:-translate-y-0.5";

  const styles = `${baseStyles} ${variantStyles}`;

  if (href) {
    return (
      <Link href={href} className={styles}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${styles} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </button>
  );
}