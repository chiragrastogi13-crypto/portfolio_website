import { useEffect, useRef, useState } from "react";
import { api } from "../api";

/**
 * Inline contentEditable field. Uncontrolled: the initial text is written to
 * the DOM once on mount, and the new value is pushed up on blur. We deliberately
 * do NOT sync `value` back into the node after mount, which keeps the caret from
 * jumping while the user types.
 */
export default function Editable({
  value,
  onCommit,
  tag = "span",
  className = "",
  placeholder = "",
  style,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.innerText = value ?? "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Tag = tag;
  return (
    <Tag
      ref={ref}
      className={className}
      style={style}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onBlur={(e) => onCommit(e.currentTarget.innerText.trim())}
    />
  );
}

/**
 * Editable image: shows the image with a camera button that opens the device
 * file picker. The chosen file is uploaded to the backend, which enhances it
 * (sharpness/contrast/color) and returns a URL that we then store.
 */
export function EditableImage({ src, alt = "", className = "", onCommit, style }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const { url } = await api.uploadImage(file);
      onCommit(url);
    } catch (ex) {
      setErr(ex.message || "Upload failed");
      setTimeout(() => setErr(""), 4000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="edit-wrap d-inline-block">
      <img src={src} alt={alt} className={className} style={style} />
      <button
        type="button"
        className="edit-img-btn"
        title="Upload image from your device"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        <i className={`fas ${busy ? "fa-spinner fa-spin" : "fa-camera"}`}></i>
      </button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onFile} />
      {busy && <span className="upload-overlay">Enhancing…</span>}
      {err && <span className="upload-err">{err}</span>}
    </span>
  );
}
