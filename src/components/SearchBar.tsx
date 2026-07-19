import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { suggest } from "../lib/search";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  size?: "sm" | "md" | "lg";
  autoFocus?: boolean;
  placeholder?: string;
  onMicResult?: (text: string) => void;
  onLucky?: () => void;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  size = "md",
  autoFocus,
  placeholder = "Search the web",
  onMicResult,
  onLucky,
}: Props) {
  const [sugg, setSugg] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // Suggestions
  useEffect(() => {
    if (!value.trim()) {
      setSugg([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const list = await suggest(value, ctrl.signal);
        setSugg(list);
        setHighlight(-1);
      } catch {
        /* ignore */
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  // Mic via Web Speech API
  const startMic = () => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Voice search isn't supported in this browser.");
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      onChange(text);
      onMicResult?.(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const sizes = {
    sm: "h-9 text-sm",
    md: "h-11 text-[15px]",
    lg: "h-14 text-base md:text-lg rounded-full",
  };

  return (
    <div ref={wrapRef} className={`relative w-full ${size === "lg" ? "max-w-2xl" : "max-w-3xl"}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (highlight >= 0 && sugg[highlight]) {
            onChange(sugg[highlight]);
            onSubmit(sugg[highlight]);
          } else {
            onSubmit(value);
          }
          setOpen(false);
          inputRef.current?.blur();
        }}
        className={`group flex items-center gap-2 ${sizes[size]} bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 hover:shadow-soft focus-within:shadow-soft focus-within:border-accent-500 dark:focus-within:border-accent-500 transition-all ${size === "lg" ? "px-5" : "px-4"} rounded-full`}
      >
        <Icon.Search className="shrink-0 opacity-60" width={size === "lg" ? 20 : 16} height={size === "lg" ? 20 : 16} />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open || sugg.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(sugg.length - 1, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(-1, h - 1));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none placeholder:text-ink-400"
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            className="p-1 rounded-full hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-500"
            aria-label="Clear"
          >
            <Icon.Close width={14} height={14} />
          </button>
        )}
        {onMicResult && (
          <button
            type="button"
            onClick={startMic}
            className={`p-1.5 rounded-full hover:bg-ink-100 dark:hover:bg-ink-800 ${listening ? "text-red-500" : "text-ink-500"}`}
            aria-label="Voice search"
            title="Voice search"
          >
            <Icon.Mic width={16} height={16} />
          </button>
        )}
        <button
          type="submit"
          className="p-1.5 rounded-full hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-500"
          aria-label="Search"
          title="Search"
        >
          <Icon.ArrowRight width={14} height={14} />
        </button>
        {onLucky && size === "lg" && (
          <button
            type="button"
            onClick={onLucky}
            className="hidden md:inline-flex text-[13px] px-3 py-1 rounded-full text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800"
            title="I'm feeling curious"
          >
            I'm Feeling Curious
          </button>
        )}
      </form>

      {open && sugg.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-2xl shadow-pop overflow-hidden z-50 animate-fade-in">
          {sugg.map((s, i) => (
            <button
              type="button"
              key={s}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s);
                onSubmit(s);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm ${
                highlight === i ? "bg-ink-100 dark:bg-ink-800" : ""
              }`}
            >
              <Icon.Search className="opacity-50" width={14} height={14} />
              <span className="truncate">{s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
