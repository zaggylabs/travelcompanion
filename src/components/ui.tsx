import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export function Button({
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600",
        variant === "primary" && "bg-teal-600 text-white hover:bg-teal-700",
        variant === "secondary" && "border border-line bg-surface hover:bg-muted",
        variant === "ghost" && "text-subtle hover:bg-muted hover:text-foreground",
        variant === "danger" && "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950",
        className,
      )}
    />
  );
}

const fieldClass =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm placeholder:text-subtle/70 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldClass, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(fieldClass, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(fieldClass, props.className)} />;
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-1 text-xs font-medium text-subtle", className)}>
      {label}
      {children}
    </label>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-xl border border-line bg-surface", className)}>{children}</div>;
}
