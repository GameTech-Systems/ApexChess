import { useId, type InputHTMLAttributes } from "react";

/** A page title with its Back button beside it, so leaving never needs a scroll to the bottom. */
export function PageHead({
  title,
  onBack,
  backLabel = "Back",
}: {
  title: string;
  /** Leave out to hide the button, for a moment when leaving would lose something. */
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      {onBack && (
        <button type="button" onClick={onBack}>
          {backLabel}
        </button>
      )}
    </div>
  );
}

/** A text box with its label above it and an optional hint below, read out with the box. */
export function Field({
  label,
  hint,
  onChange,
  ...input
}: {
  label: string;
  hint?: string;
  onChange: (value: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        {...input}
      />
      {hint && (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}
