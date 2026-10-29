import { useEffect, useId, useState, type ReactNode } from "react";
import { useLocale } from "./locale.js";
import { decideNumberFieldCommit, type NumberFieldCommitTrigger } from "./number-field-policy.js";

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    play: <path d="m8 5 11 7-11 7z" />,
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    reset: (
      <>
        <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />
      </>
    ),
    sound: (
      <>
        <path d="m4 9 4 0 5-4v14l-5-4H4zM17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14" />
      </>
    ),
    mute: (
      <>
        <path d="m4 9 4 0 5-4v14l-5-4H4zM17 9l5 6m0-6-5 6" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    box: (
      <>
        <path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M7 5l10 5" />
      </>
    ),
    sphere: (
      <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </>
    ),
    capsule: <rect x="7" y="3" width="10" height="18" rx="5" />,
    listener: (
      <>
        <path d="M5 14v-3a7 7 0 0 1 14 0v3M5 11H3v7h4v-7zm14 0h2v7h-4v-7z" />
      </>
    ),
    undo: <path d="M8 5 3 10l5 5M3 10h12a5 5 0 0 1 0 10" />,
    redo: <path d="m16 5 5 5-5 5m5-5H9a5 5 0 0 0 0 10" />,
    duplicate: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V4H4v12h4" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6" />
      </>
    ),
    save: (
      <>
        <path d="M4 3h14l3 3v15H3V3zM7 3v6h10V3M7 21v-8h10v8" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    layers: (
      <>
        <path d="m12 3 10 6-10 6L2 9zm-9 11 9 5 9-5M3 18l9 5 9-5" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10v1" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 1v4m0 14v4M1 12h4m14 0h4" />
      </>
    ),
    record: <circle cx="12" cy="12" r="7" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.info}
    </svg>
  );
}

export function Badge({
  children,
  kind = "neutral",
}: {
  children: ReactNode;
  kind?: "neutral" | "accent" | "success" | "warning" | "danger";
}) {
  return <span className={`badge badge-${kind}`}>{children}</span>;
}

export function NumberField({
  label,
  value,
  onCommit,
  unit,
  min,
  max,
  step = 0.1,
  disabled = false,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const [draft, setDraft] = useState(String(value));
  const messageId = useId();
  const [dirty, setDirty] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const bounds = `${min !== undefined ? ` ≥ ${min}` : ""}${max !== undefined ? ` ≤ ${max}` : ""}`;
  const error = invalid ? t("common.finiteNumber", { bounds }) : "";
  useEffect(() => {
    if (!dirty) setDraft(String(value));
  }, [value, dirty]);
  const commit = (trigger: NumberFieldCommitTrigger) => {
    const decision = decideNumberFieldCommit({ raw: draft, dirty, min, max }, trigger);
    if (decision.kind === "retain") return;
    if (decision.kind === "invalid") {
      setInvalid(true);
      return;
    }
    onCommit(decision.value);
    setDirty(false);
    setInvalid(false);
  };
  return (
    <label className={`number-field ${error ? "field-error" : ""}`}>
      <span className="field-label">
        {label}
        {unit && <span className="field-unit">{unit}</span>}
      </span>
      <input
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? messageId : undefined}
        title={error || undefined}
        onChange={(event) => {
          setDraft(event.target.value);
          setDirty(true);
          setInvalid(false);
        }}
        onBlur={(event) => {
          const localeControl =
            event.relatedTarget instanceof Element &&
            event.relatedTarget.closest("[data-locale-control]");
          commit({ type: "blur", intent: localeControl ? "locale" : "other" });
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter") {
            event.preventDefault();
            commit({ type: "enter", isComposing: event.nativeEvent.isComposing });
          }
          if (event.key === "Escape") {
            setDraft(String(value));
            setDirty(false);
            setInvalid(false);
            event.stopPropagation();
          }
        }}
      />
      {error && (
        <span className="field-message" id={messageId}>
          {error}
        </span>
      )}
    </label>
  );
}

export function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="inspector-section">
      <header className="section-header">
        <h3>{title}</h3>
        {aside}
      </header>
      {children}
    </section>
  );
}
