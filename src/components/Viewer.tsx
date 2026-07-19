import { useEffect, useRef, useState } from "react";
import { fetchPage, canIframeLoad } from "../lib/proxy";
import { Icon } from "./icons";
import { faviconUrl, domainOf } from "../lib/storage";

interface Props {
  url: string;
  title: string;
  onOpenInReader: (url: string, title: string) => void;
  onOpenExternal: () => void;
  onTitleChange?: (title: string) => void;
}

export function Viewer({
  url,
  title,
  onOpenInReader,
  onOpenExternal,
  onTitleChange,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "blocked" | "error">("loading");
  const [errMsg, setErrMsg] = useState<string>("");
  const [proxyHtml, setProxyHtml] = useState<string | null>(null);
  const [proxyLoading, setProxyLoading] = useState(false);
  const [useProxy, setUseProxy] = useState(false);
  const [, setLastLoaded] = useState<string>("");

  // Try to detect if we can iframe this URL.
  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setErrMsg("");
    setProxyHtml(null);
    setUseProxy(false);
    canIframeLoad(url).then((ok) => {
      if (cancelled) return;
      if (ok) setState("ok");
      else setState("blocked");
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  // When we should use the proxy (because direct iframe was blocked), fetch
  // the page and stuff it into srcdoc.
  useEffect(() => {
    if (state !== "blocked" || useProxy) return;
    setProxyLoading(true);
    fetchPage(url)
      .then((html) => {
        // Strip <script> and <iframe> tags from the proxied HTML so we don't
        // embed hostile scripts or break the layout.
        const sanitized = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
          // Add <base> so relative links resolve correctly.
          .replace(/<head([^>]*)>/i, `<head$1><base href="${url}" target="_blank" />`);
        setProxyHtml(sanitized);
        setLastLoaded(url);
      })
      .catch((e: any) => {
        setState("error");
        setErrMsg(e?.message || "Proxy fetch failed");
      })
      .finally(() => setProxyLoading(false));
  }, [state, useProxy, url]);

  // If we're in proxy mode, render the sanitized HTML
  const iframeSrc = useProxy && proxyHtml
    ? undefined
    : state === "ok"
    ? url
    : undefined;
  const srcdoc = useProxy && proxyHtml ? proxyHtml : undefined;

  return (
    <div className="h-full flex flex-col">
      {/* URL/title bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950">
        <img
          src={faviconUrl(url)}
          alt=""
          className="w-4 h-4 rounded-sm"
          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
        <div className="text-sm font-medium truncate flex-1">{title || domainOf(url)}</div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-ink-500 hover:text-accent-500 flex items-center gap-1"
        >
          <Icon.External width={12} height={12} /> Open
        </a>
        <button
          onClick={() => onOpenInReader(url, title)}
          className="text-xs text-ink-500 hover:text-accent-500 flex items-center gap-1"
          title="Switch to clean reader mode"
        >
          <Icon.Reader width={12} height={12} /> Reader
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 relative bg-ink-50 dark:bg-ink-900">
        {state === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="lm-spin w-8 h-8 text-accent-500 mx-auto mb-2" />
              <div className="text-xs text-ink-500">Loading {domainOf(url)}…</div>
            </div>
          </div>
        )}

        {state === "blocked" && !useProxy && !proxyHtml && !proxyLoading && (
          <BlockedScreen
            url={url}
            onOpenExternal={onOpenExternal}
            onUseProxy={() => setUseProxy(true)}
            onReader={() => onOpenInReader(url, title)}
          />
        )}

        {state === "blocked" && proxyLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="lm-spin w-8 h-8 text-accent-500 mx-auto mb-2" />
              <div className="text-xs text-ink-500">
                Fetching via proxy (this page blocks iframes)…
              </div>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-md text-center">
              <div className="text-4xl mb-2">🚫</div>
              <div className="font-semibold">Couldn't load this page</div>
              <div className="text-sm text-ink-500 mt-1">{errMsg}</div>
              <div className="flex gap-2 justify-center mt-4">
                <button
                  onClick={onOpenExternal}
                  className="px-3 py-1.5 text-sm rounded-md bg-accent-500 text-white hover:bg-accent-600"
                >
                  Open in new tab
                </button>
                <button
                  onClick={() => onOpenInReader(url, title)}
                  className="px-3 py-1.5 text-sm rounded-md border border-ink-200 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-800"
                >
                  Reader mode
                </button>
              </div>
            </div>
          </div>
        )}

        {((state === "ok" && iframeSrc) || srcdoc) && (
          <iframe
            key={url + (srcdoc ? "_p" : "")}
            ref={iframeRef}
            src={iframeSrc}
            srcDoc={srcdoc}
            className="lm-iframe"
            sandbox={srcdoc ? "allow-same-origin allow-popups allow-forms" : undefined}
            referrerPolicy="no-referrer"
            title={title}
            onLoad={() => {
              setLastLoaded(url);
              try {
                const doc = iframeRef.current?.contentDocument;
                const t = doc?.title?.trim();
                if (t && onTitleChange) onTitleChange(t);
              } catch {
                /* cross-origin */
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

function BlockedScreen({
  url,
  onOpenExternal,
  onUseProxy,
  onReader,
}: {
  url: string;
  onOpenExternal: () => void;
  onUseProxy: () => void;
  onReader: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="text-5xl mb-3">🛡️</div>
        <div className="font-semibold text-lg">This page refuses to be embedded</div>
        <p className="text-sm text-ink-500 mt-2">
          <span className="font-medium">{domainOf(url)}</span> sends an
          <code className="px-1 py-0.5 mx-1 rounded bg-ink-200 dark:bg-ink-800 text-xs">X-Frame-Options</code>
          header, so we can't display it inside the browser.
        </p>
        <div className="flex flex-wrap gap-2 justify-center mt-5">
          <button
            onClick={onOpenExternal}
            className="px-3 py-1.5 text-sm rounded-md bg-accent-500 text-white hover:bg-accent-600 flex items-center gap-1.5"
          >
            <Icon.External width={12} height={12} /> Open in new tab
          </button>
          <button
            onClick={onUseProxy}
            className="px-3 py-1.5 text-sm rounded-md border border-ink-200 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-800"
          >
            Try via CORS proxy
          </button>
          <button
            onClick={onReader}
            className="px-3 py-1.5 text-sm rounded-md border border-ink-200 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-800 flex items-center gap-1.5"
          >
            <Icon.Reader width={12} height={12} /> Clean reader
          </button>
        </div>
        <div className="mt-5 text-xs text-ink-400 break-all opacity-70">{url}</div>
      </div>
    </div>
  );
}
