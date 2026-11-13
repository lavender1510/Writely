import { useRef, useState } from "react";
import { base64 } from "../core/crypto";
import { newBook, bookDescendants, bookNodeTitle } from "../core/book-model";
import type {
  BookMetadata,
  BookProject,
  BookNode,
  BookNodeKind,
} from "../core/book-types";
import { useDialogFocus } from "./dialog-focus";
export const kindNames: Record<BookNodeKind, string> = {
  part: "Teil",
  folder: "Gruppe",
  chapter: "Kapitel",
  scene: "Szene",
};
export function BookProjectDialog({
  project,
  coverSrc,
  onClose,
  onSave,
}: {
  project?: BookProject;
  coverSrc?: string | null;
  onClose: () => void;
  onSave: (
    meta: BookMetadata,
    cover?: { src: string; alt: string } | null,
  ) => Promise<void>;
}) {
  const initial = project || newBook(),
    [meta, setMeta] = useState<BookMetadata>({
      title: initial.title,
      subtitle: initial.subtitle,
      author: initial.author,
      pseudonym: initial.pseudonym,
      genre: initial.genre,
      language: initial.language,
      description: initial.description,
      notes: initial.notes,
      series: initial.series,
      goalWords: initial.goalWords,
      color: initial.color,
    });
  const [cover, setCover] = useState<
      { src: string; alt: string } | null | undefined
    >(),
    [alt, setAlt] = useState(project?.cover?.alt || "Buchcover"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    ref = useRef<HTMLFormElement>(null);
  useDialogFocus(ref, () => {
    if (!busy) onClose();
  });
  const image = cover === null ? null : cover?.src || coverSrc;
  return (
    <div className="modal-backdrop">
      <form
        className="modal book-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={
          project ? "Buchprojekt bearbeiten" : "Buchprojekt erstellen"
        }
        ref={ref}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSave(
              meta,
              cover === undefined && image && alt !== project?.cover?.alt
                ? { src: image, alt }
                : cover
                  ? { ...cover, alt }
                  : cover,
            );
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>{project ? "Dein Buchprojekt" : "Ein neues Buch beginnt."}</h2>
        <p>
          Ein eigener Schreibplatz für Manuskript, Kapitel und Szenen. Lokal und
          verschlüsselt.
        </p>
        <fieldset disabled={busy}>
          <div className="book-form-grid">
            {(
              [
                ["title", "Buchtitel", 500],
                ["subtitle", "Untertitel", 500],
                ["author", "Autor", 200],
                ["pseudonym", "Pseudonym", 200],
                ["genre", "Genre", 120],
                ["series", "Serie", 200],
              ] as const
            ).map(([id, label, max]) => (
              <label key={id}>
                {label}
                <input
                  aria-label={label}
                  required={id === "title"}
                  maxLength={max}
                  value={meta[id]}
                  onChange={(e) => setMeta({ ...meta, [id]: e.target.value })}
                />
              </label>
            ))}
            <label>
              Sprache
              <select
                aria-label="Buchsprache"
                value={meta.language}
                onChange={(e) => setMeta({ ...meta, language: e.target.value })}
              >
                <option value="de-DE">Deutsch</option>
                <option value="en-US">Englisch</option>
                {!["de-DE", "en-US"].includes(meta.language) && (
                  <option>{meta.language}</option>
                )}
              </select>
            </label>
            <label>
              Geplante Wörter
              <input
                aria-label="Geplante Wörter"
                type="number"
                min={0}
                max={100000000}
                value={meta.goalWords}
                onChange={(e) =>
                  setMeta({ ...meta, goalWords: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Projektfarbe
              <input
                aria-label="Projektfarbe"
                type="color"
                value={meta.color}
                onChange={(e) => setMeta({ ...meta, color: e.target.value })}
              />
            </label>
          </div>
          <label>
            Kurzbeschreibung
            <textarea
              aria-label="Kurzbeschreibung"
              maxLength={20000}
              rows={3}
              value={meta.description}
              onChange={(e) =>
                setMeta({ ...meta, description: e.target.value })
              }
            />
          </label>
          <label>
            Private Projektnotizen
            <textarea
              aria-label="Private Projektnotizen"
              maxLength={100000}
              rows={3}
              value={meta.notes}
              onChange={(e) => setMeta({ ...meta, notes: e.target.value })}
            />
          </label>
          <label>
            Cover (PNG, JPEG oder WebP, maximal 5 MB)
            <input
              aria-label="Buchcover auswählen"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setBusy(true);
                setError("");
                let url = "";
                try {
                  if (f.size > 5 * 1024 * 1024)
                    throw new Error("Das Cover darf höchstens 5 MB groß sein.");
                  url = URL.createObjectURL(f);
                  const img = new Image();
                  img.src = url;
                  await img.decode();
                  setCover({
                    src:
                      "data:" +
                      f.type +
                      ";base64," +
                      base64(new Uint8Array(await f.arrayBuffer())),
                    alt,
                  });
                } catch {
                  setError(
                    "Das Cover konnte nicht gelesen werden. Wähle ein gültiges PNG-, JPEG- oder WebP-Bild bis 5 MB.",
                  );
                } finally {
                  if (url) URL.revokeObjectURL(url);
                  setBusy(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
          {image && (
            <div className="book-cover-preview">
              <img src={image} alt={alt} />
              <label>
                Alternativtext
                <input
                  aria-label="Cover-Alternativtext"
                  maxLength={500}
                  value={alt}
                  onChange={(e) => setAlt(e.target.value)}
                />
              </label>
              <button type="button" onClick={() => setCover(null)}>
                Cover entfernen
              </button>
            </div>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              Abbrechen
            </button>
            <button className="primary-button" type="submit">
              {busy
                ? "Wird verschlüsselt gespeichert …"
                : project
                  ? "Projekt speichern"
                  : "Buchprojekt erstellen"}
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
export interface BookEntryInput {
  kind: BookNodeKind;
  title: string;
  parentId: string | null;
  synopsis: string;
  notes: string;
  statusId: string;
  color: string;
}
export function BookEntryDialog({
  project,
  initial,
  parent,
  onClose,
  onSave,
}: {
  project: BookProject;
  initial?: BookNode;
  parent?: string | null;
  onClose: () => void;
  onSave: (entry: BookEntryInput) => Promise<void>;
}) {
  const [value, setValue] = useState<BookEntryInput>({
      kind: initial?.kind || "chapter",
      title: initial ? initial.title : "Neues Kapitel",
      parentId: initial?.parentId ?? parent ?? null,
      synopsis: initial?.synopsis || "",
      notes: initial?.notes || "",
      statusId: initial?.statusId || project.statuses[0].id,
      color: initial?.color || project.color,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    ref = useRef<HTMLFormElement>(null);
  useDialogFocus(ref, () => {
    if (!busy) onClose();
  });
  const excluded = initial ? bookDescendants(project, initial.id) : new Set();
  return (
    <div className="modal-backdrop">
      <form
        className="modal book-dialog"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={
          initial ? "Eintrag bearbeiten" : "Manuskripteintrag erstellen"
        }
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSave(value);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>{initial ? "Eintrag bearbeiten" : "Dein Manuskript wächst."}</h2>
        <fieldset disabled={busy}>
          <label>
            Art
            <select
              aria-label="Eintragsart"
              disabled={!!initial}
              value={value.kind}
              onChange={(e) =>
                setValue({
                  ...value,
                  kind: e.target.value as BookNodeKind,
                  title: [
                    "Neues Kapitel",
                    "Neue Szene",
                    "Neuer Teil",
                    "Neue Gruppe",
                  ].includes(value.title)
                    ? {
                        chapter: "Neues Kapitel",
                        scene: "Neue Szene",
                        part: "Neuer Teil",
                        folder: "Neue Gruppe",
                      }[e.target.value as BookNodeKind]
                    : value.title,
                })
              }
            >
              {Object.entries(kindNames).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Titel
            <input
              aria-label="Eintragstitel"
              maxLength={500}
              value={value.title}
              onChange={(e) => setValue({ ...value, title: e.target.value })}
            />
          </label>
          <label>
            Übergeordneter Eintrag
            <select
              aria-label="Übergeordneter Eintrag"
              value={value.parentId || ""}
              onChange={(e) =>
                setValue({ ...value, parentId: e.target.value || null })
              }
            >
              <option value="">Manuskript</option>
              {project.nodes
                .filter(
                  (n) =>
                    !n.deletedAt && n.kind !== "scene" && !excluded.has(n.id),
                )
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {bookNodeTitle(n)}
                  </option>
                ))}
            </select>
          </label>
          <div className="book-form-grid">
            <label>
              Status
              <select
                aria-label="Eintragsstatus"
                value={value.statusId}
                onChange={(e) =>
                  setValue({ ...value, statusId: e.target.value })
                }
              >
                {project.statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Farbe
              <input
                aria-label="Eintragsfarbe"
                type="color"
                value={value.color}
                onChange={(e) => setValue({ ...value, color: e.target.value })}
              />
            </label>
          </div>
          <label>
            Zusammenfassung
            <textarea
              aria-label="Zusammenfassung"
              maxLength={10000}
              rows={4}
              value={value.synopsis}
              onChange={(e) => setValue({ ...value, synopsis: e.target.value })}
            />
          </label>
          <label>
            Private Notizen
            <textarea
              aria-label="Private Eintragsnotizen"
              maxLength={100000}
              rows={4}
              value={value.notes}
              onChange={(e) => setValue({ ...value, notes: e.target.value })}
            />
          </label>
          <p>
            Zusammenfassung und private Notizen gehören zur Planung, nicht zum
            Manuskripttext.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              Abbrechen
            </button>
            <button className="primary-button">
              {busy
                ? "Wird gespeichert …"
                : initial
                  ? "Eintrag speichern"
                  : "Eintrag erstellen"}
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
export function BookStatusDialog({
  project,
  onClose,
  onSave,
}: {
  project: BookProject;
  onClose: () => void;
  onSave: (id: string | null, label: string, color: string) => Promise<void>;
}) {
  const [id, setId] = useState(""),
    [label, setLabel] = useState(""),
    [color, setColor] = useState(project.color),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    ref = useRef<HTMLFormElement>(null);
  useDialogFocus(ref, () => {
    if (!busy) onClose();
  });
  return (
    <div className="modal-backdrop">
      <form
        ref={ref}
        className="modal book-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Projektstatus verwalten"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSave(id || null, label, color);
            if (!id) {
              setLabel("");
              setId("");
            }
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Deine Statuswerte</h2>
        <fieldset disabled={busy}>
          <label>
            Status
            <select
              aria-label="Projektstatus auswählen"
              value={id}
              onChange={(e) => {
                setId(e.target.value);
                const s = project.statuses.find((s) => s.id === e.target.value);
                setLabel(s?.label || "");
                setColor(s?.color || project.color);
              }}
            >
              <option value="">Neuen Status anlegen</option>
              {project.statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Bezeichnung
            <input
              aria-label="Statusbezeichnung"
              required
              maxLength={120}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label>
            Farbe
            <input
              aria-label="Statusfarbe"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <div className="modal-actions">
            <button className="primary-button" type="submit">
              Status speichern
            </button>
            <button type="button" onClick={onClose}>
              Schließen
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
