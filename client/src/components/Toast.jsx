import { useEffect } from "react";

export function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, toast.duration ?? 4000);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;
  return (
    <div className={`toast ${toast.kind ?? ""}`} onClick={onClose}>
      <div className="title">{toast.title}</div>
      {toast.body ? <div className="body">{toast.body}</div> : null}
    </div>
  );
}
