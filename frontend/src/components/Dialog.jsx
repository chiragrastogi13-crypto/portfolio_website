import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

/**
 * Promise-based dialog service — a professional replacement for the native
 * window.confirm / window.prompt / window.alert popups.
 *
 *   const dialog = useDialog();
 *   if (await dialog.confirm({ title, message, confirmText, danger })) { ... }
 *   const value = await dialog.prompt({ title, message, defaultValue });  // string | null
 *   await dialog.alert({ title, message });
 *
 * Each returns a Promise so callers read like the native APIs they replace.
 */
const DialogCtx = createContext(null);

const norm = (o) => (typeof o === "string" ? { message: o } : (o || {}));

export function DialogProvider({ children }) {
  const [cfg, setCfg] = useState(null);
  const [val, setVal] = useState("");
  const resolver = useRef(null);
  const inputRef = useRef(null);
  const okRef = useRef(null);

  const open = useCallback(
    (c) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setVal(c.defaultValue ?? "");
        setCfg(c);
      }),
    []
  );

  const settle = useCallback((result) => {
    setCfg(null);
    const r = resolver.current;
    resolver.current = null;
    if (r) r(result);
  }, []);

  const cancel = useCallback(() => settle(cfg?.type === "prompt" ? null : cfg?.type === "alert" ? undefined : false), [cfg, settle]);
  const ok = useCallback(() => settle(cfg?.type === "prompt" ? val : cfg?.type === "alert" ? undefined : true), [cfg, val, settle]);

  // Focus the right control + wire Esc (cancel) / Enter (confirm).
  useEffect(() => {
    if (!cfg) return;
    const t = setTimeout(() => (cfg.type === "prompt" ? inputRef.current : okRef.current)?.focus(), 40);
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); cancel(); }
      else if (e.key === "Enter" && cfg.type !== "prompt") { e.preventDefault(); ok(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [cfg, cancel, ok]);

  const apiRef = useRef({
    confirm: (o) => open({ type: "confirm", confirmText: "Confirm", cancelText: "Cancel", ...norm(o) }),
    prompt: (o) => open({ type: "prompt", confirmText: "Save", cancelText: "Cancel", ...norm(o) }),
    alert: (o) => open({ type: "alert", confirmText: "OK", ...norm(o) }),
  });

  return (
    <DialogCtx.Provider value={apiRef.current}>
      {children}
      {cfg && (
        <div className="wl-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) cancel(); }}>
          <div className="wl-dialog" role="dialog" aria-modal="true" aria-label={cfg.title || "Dialog"}>
            {cfg.title && <h3 className="wl-dialog-title">{cfg.title}</h3>}
            {cfg.message && <p className="wl-dialog-msg">{cfg.message}</p>}
            {cfg.type === "prompt" && (
              <input
                ref={inputRef}
                className="wl-dialog-input"
                value={val}
                placeholder={cfg.placeholder || ""}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ok(); } }}
              />
            )}
            <div className="wl-dialog-actions">
              {cfg.type !== "alert" && (
                <button type="button" className="wl-dialog-btn wl-dialog-cancel" onClick={cancel}>{cfg.cancelText}</button>
              )}
              <button ref={okRef} type="button" className={`wl-dialog-btn ${cfg.danger ? "wl-dialog-danger" : "wl-dialog-primary"}`} onClick={ok}>
                {cfg.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogCtx.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogCtx);
  if (!ctx) throw new Error("useDialog must be used within <DialogProvider>");
  return ctx;
}
