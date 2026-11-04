import {
  cloneElement,
  memo,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import { useLocale } from "./locale.js";
import { canonicalTokens, designTokenStyle } from "./tokens.js";

type TriggerProps = HTMLAttributes<HTMLElement> & { disabled?: boolean };
let closeActiveTip: (() => void) | null = null;
let adjacentPointerTip = false;

/** Supplementary text stays described-by even when visually closed. A disabled
 * control keeps its native semantics and gets a separate focusable info button. */
function HelpTipView({
  topic,
  content,
  children,
}: {
  topic: string;
  content: string;
  children?: ReactElement<TriggerProps>;
}) {
  const { t } = useLocale();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const currentPosition = useRef(position);
  const updateOnContentChange = useRef<(() => void) | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const touch = useRef(false);
  const wasOpen = useRef(false);
  const [animate, setAnimate] = useState(false);
  const disabled = children?.props.disabled;
  const close = () => setOpen(false);
  const handlers: HTMLAttributes<HTMLElement> = {
    onPointerEnter: (event) => {
      if (
        event.pointerType !== "touch" &&
        window.matchMedia("(hover: hover) and (pointer: fine)").matches
      ) {
        setAnimate(!closeActiveTip && !adjacentPointerTip);
        setOpen(true);
      }
    },
    onPointerLeave: (event) => {
      if (event.pointerType !== "touch") {
        adjacentPointerTip = open;
        window.requestAnimationFrame?.(() => {
          adjacentPointerTip = false;
        });
        close();
      }
    },
    onPointerCancel: close,
    onPointerDown: (event) => {
      touch.current = event.pointerType === "touch";
      wasOpen.current = open;
    },
    onFocus: () => {
      setAnimate(false);
      if (!touch.current) setOpen(true);
    },
    onBlur: () => {
      touch.current = false;
      close();
    },
    onKeyDown: (event) => {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    },
    onClick: () => {
      if (touch.current) {
        setAnimate(false);
        setOpen(!wasOpen.current);
      }
    },
  };
  // Run before installing the open effect so opening measures exactly once,
  // including when content changes in the same publication.
  useLayoutEffect(() => {
    if (open) updateOnContentChange.current?.();
  }, [open, content]);
  useLayoutEffect(() => {
    if (!open) return;
    let active = true;
    closeActiveTip?.();
    closeActiveTip = close;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (anchor.current?.contains(document.activeElement)) {
        event.preventDefault();
        event.stopPropagation();
      }
      close();
    };
    const update = () => {
      if (!active || !anchor.current || !bubble.current) return;
      const target = anchor.current.getBoundingClientRect();
      const box = bubble.current.getBoundingClientRect();
      const gap = Number.parseFloat(canonicalTokens.spacing["2"].$value);
      const viewport = window.visualViewport;
      const x = viewport?.offsetLeft ?? 0,
        y = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const below = target.bottom + gap;
      const top = below + box.height <= y + height - gap ? below : target.top - gap - box.height;
      const next = {
        left: Math.max(x + gap, Math.min(target.left, x + width - box.width - gap)),
        top: Math.max(y + gap, Math.min(top, y + height - box.height - gap)),
      };
      if (next.left !== currentPosition.current.left || next.top !== currentPosition.current.top) {
        currentPosition.current = next;
        setPosition(next);
      }
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (observer) {
      if (anchor.current) observer.observe(anchor.current, { box: "border-box" });
      if (bubble.current) observer.observe(bubble.current, { box: "border-box" });
    } else updateOnContentChange.current = update;
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("blur", close);
    document.addEventListener("keydown", escape, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      active = false;
      observer?.disconnect();
      updateOnContentChange.current = null;
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("blur", close);
      document.removeEventListener("keydown", escape, true);
      if (closeActiveTip === close) closeActiveTip = null;
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [open]);
  const describedBy = [children?.props["aria-describedby"], id].filter(Boolean).join(" ");
  const trigger =
    children && !disabled ? (
      cloneElement(children, {
        "aria-describedby": describedBy,
        ...Object.fromEntries(
          Object.entries(handlers).map(([name, handler]) => [
            name,
            (event: never) => {
              (handler as (event: never) => void)(event);
              (
                children.props[name as keyof TriggerProps] as ((event: never) => void) | undefined
              )?.(event);
            },
          ]),
        ),
      })
    ) : (
      <button
        type="button"
        className="help-tip-trigger"
        aria-label={t("help.about", { topic })}
        aria-describedby={id}
        {...handlers}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6m0-10v1" />
        </svg>
      </button>
    );
  const tooltip = (
    <span
      ref={bubble}
      id={id}
      role="tooltip"
      hidden={!open}
      className={
        open ? `help-tip-bubble${animate ? " help-tip-animate" : ""}` : "sr-only help-tip-text"
      }
      style={open ? { ...designTokenStyle, ...position } : undefined}
    >
      {content}
    </span>
  );
  const portalTarget = open ? (anchor.current?.closest("dialog") ?? document.body) : null;
  return (
    <span ref={anchor} className={`help-tip${children ? " help-tip-control" : ""}`}>
      {disabled && children && cloneElement(children, { "aria-describedby": describedBy })}
      {trigger}
      {portalTarget ? createPortal(tooltip, portalTarget) : tooltip}
    </span>
  );
}

export const HelpTip = memo(HelpTipView);
