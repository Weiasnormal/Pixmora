"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { AlertTriangle, CircleAlert, Info, X } from "lucide-react";

const BUTTON_BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100";

const BUTTON_VARIANTS = {
  primary: "bg-primary text-ink hover:bg-primary-hover",
  secondary: "border border-line bg-panel text-ink hover:bg-page",
  ghost: "text-ink hover:bg-page",
  danger: "border border-line bg-panel text-danger hover:bg-page",
};

const BUTTON_SIZES = { sm: "h-8 px-3 text-[13px] max-md:h-11", md: "h-10 px-4 text-sm max-md:h-11" };

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...props}
    />
  );
}

export function IconButton({
  label,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink transition-[background-color,transform] duration-150 ease-out hover:bg-page active:scale-95 max-md:size-11 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${className}`}
      {...props}
    />
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-[13px] font-semibold text-ink">{children}</h3>;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] text-muted">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const INPUT =
  "h-9 w-full min-w-0 rounded-lg border border-line bg-panel px-2.5 text-sm text-ink transition-colors duration-150 hover:border-line-strong aria-invalid:border-danger max-md:h-11 max-md:text-base";

export function TextField({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      type="text"
      className={INPUT}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function SelectField({
  value,
  onChange,
  children,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <select
      className={INPUT}
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  );
}

/** Typed entry that keeps exact values, with no sliders or hidden rounding. */
export function NumberField({
  value,
  onCommit,
  min = 0,
  max,
  step = 0.1,
  suffix,
  integer = false,
  ariaLabel,
}: {
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  integer?: boolean;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const parse = (text: string): number | null => {
    if (text.trim() === "") return null;
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || parsed < min) return null;
    if (max !== undefined && parsed > max) return null;
    if (integer && !Number.isInteger(parsed)) return null;
    return parsed;
  };

  const invalid = draft !== null && parse(draft) === null;

  return (
    <div className="relative min-w-0">
      <input
        type="number"
        inputMode={integer ? "numeric" : "decimal"}
        className={`${INPUT} tabular-nums ${suffix ? "pr-9" : ""}`}
        value={draft ?? String(value)}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        onChange={(event) => {
          setDraft(event.target.value);
          const parsed = parse(event.target.value);
          if (parsed !== null) onCommit(parsed);
        }}
        onBlur={() => setDraft(null)}
      />
      {suffix ? (
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[13px] font-medium text-ink">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ease-out ${
          checked ? "bg-primary" : "bg-line-strong"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-panel transition-transform duration-150 ease-out ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </button>
    </div>
  );
}

export function Checkbox({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5">
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-[var(--brand-primary)]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-page p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
          className={`h-8 min-w-0 flex-1 rounded-md max-md:h-10 px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40 ${
            value === option.value ? "bg-panel text-ink shadow-[0_0_0_1px_var(--border-subtle)]" : "text-muted hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between text-[13px] text-muted">
        {label}
        <span className="text-ink tabular-nums">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        className="h-5 w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

const NOTICE_TONES = {
  info: { box: "bg-page text-ink", icon: Info },
  warning: { box: "bg-primary-soft text-ink", icon: AlertTriangle },
  error: { box: "bg-danger-soft text-danger", icon: CircleAlert },
};

export function Notice({
  tone = "info",
  children,
  action,
}: {
  tone?: keyof typeof NOTICE_TONES;
  children: ReactNode;
  action?: ReactNode;
}) {
  const { box, icon: Icon } = NOTICE_TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs leading-relaxed ${box}`}
    >
      <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className={`m-auto max-h-[85dvh] w-[calc(100vw-32px)] overflow-hidden rounded-2xl bg-panel p-0 text-ink shadow-xl ${
        wide ? "max-w-3xl" : "max-w-md"
      }`}
    >
      {open ? (
        <div className="flex max-h-[85dvh] flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <IconButton label="Close" onClick={onClose}>
              <X aria-hidden className="size-4" />
            </IconButton>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? (
            <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  confirmVariant = "danger",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  confirmVariant?: "danger" | "primary";
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant={confirmVariant}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-muted">{body}</p>
    </Modal>
  );
}
