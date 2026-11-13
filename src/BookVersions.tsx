import { bookNodeTitle } from "../core/book-model";
import { useRef, useState } from "react";
import type { BookRepository } from "../core/book-repository";
import type { BookNode } from "../core/book-types";
import { documentText } from "../core/document";
import { useDialogFocus } from "./dialog-focus";
export default function BookVersions({
  repo,
  node,
  onClose,
  onRestored,
  onCaptured,
}: {
  repo: BookRepository;
  node: BookNode;
  onClose: () => void;
  onRestored: () => Promise<void>;
  onCaptured: () => void;
}) {
  const ref = useRef<HTMLElement>(null),
    [index, setIndex] = useState(0),
    [preview, setPreview] = useState(""),
    [name, setName] = useState("Mein Sicherungspunkt"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useDialogFocus(ref, () => {
    if (!busy) onClose();
  });
  const versions = node.document?.history || [];
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <section
        className="modal book-dialog"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Kapitelversionen"
      >
        <h2>Versionen von {bookNodeTitle(node)}</h2>
        <p>
          Bis zu fünf verschlüsselte Sicherungspunkte. Ein wiederhergestellter
          Stand sichert vorher den aktuellen Text.
        </p>
        <label>
          Name des Sicherungspunkts
          <input
            aria-label="Sicherungsname"
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await repo.captureVersion(node.id, name);
              setPreview("");
              onCaptured();
            })
          }
        >
          Schnappschuss speichern
        </button>
        <label>
          Gesicherte Version
          <select
            aria-label="Gesicherte Kapitelversion"
            disabled={busy || !versions.length}
            value={index}
            onChange={(e) => {
              setIndex(Number(e.target.value));
              setPreview("");
            }}
          >
            {versions.map((h, i) => (
              <option key={i} value={i}>
                {h.label || h.title || "Ohne Titel"} ·{" "}
                {new Date(h.capturedAt).toLocaleString("de-DE")}
              </option>
            ))}
          </select>
        </label>
        {!versions.length && <p>Noch keine älteren Versionen.</p>}
        <div className="modal-actions">
          <button
            disabled={busy || !versions[index]}
            onClick={() =>
              void run(async () =>
                setPreview(
                  documentText(
                    (await repo.previewVersion(node.id, index)).content,
                  ),
                ),
              )
            }
          >
            Textvorschau öffnen
          </button>
          <button
            disabled={busy || !versions[index]}
            onClick={() => {
              if (
                confirm(
                  "Diese Version wiederherstellen? Der aktuelle Stand wird vorher gesichert.",
                )
              )
                void run(async () => {
                  await repo.restoreVersion(node.id, index);
                  await onRestored();
                  onClose();
                });
            }}
          >
            Kapitelversion wiederherstellen
          </button>
          <button disabled={busy} onClick={onClose}>
            Schließen
          </button>
        </div>
        {preview && (
          <pre className="book-version-preview" aria-label="Textvorschau">
            {preview}
          </pre>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
    </div>
  );
}
