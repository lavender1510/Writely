import { useState } from "react";
import { BookOpen, Plus, LockKeyhole, Trash2 } from "lucide-react";
import type { Vault } from "../core/vault";
import type { BookReference } from "../core/book-types";
import { BookProjectDialog } from "./BookDialogs";
export default function BookShelf({
  vault,
  books,
  trash,
  onOpen,
  onChanged,
}: {
  vault: Vault;
  books: BookReference[];
  trash: boolean;
  onOpen: (id: string) => void;
  onChanged: () => void;
}) {
  const [create, setCreate] = useState(false),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const visible = books.filter(
    (b) =>
      !!b.deletedAt === trash &&
      b.title.toLocaleLowerCase("de").includes(query.toLocaleLowerCase("de")),
  );
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="book-shelf" aria-label="Buchprojekte">
      <header>
        <div>
          <span className="secure-eyebrow">DEINE GESCHICHTEN</span>
          <h2>Aus einer Idee wird ein Buch.</h2>
          <p>
            Kapitel, Szenen und Entwürfe. Ein gemeinsames Manuskript, dein
            eigener Rhythmus.
          </p>
        </div>
        {!trash && (
          <button className="primary-button" onClick={() => setCreate(true)}>
            <Plus size={18} />
            Neues Buchprojekt
          </button>
        )}
      </header>
      <label className="book-search">
        Bücher suchen
        <input
          aria-label="Bücher suchen"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="book-shelf-grid">
        {visible.map((b) => (
          <article key={b.id}>
            <button
              className="book-project-open"
              disabled={busy || trash}
              onClick={() => onOpen(b.id)}
            >
              <div
                className="book-cover-placeholder"
                style={{ borderLeftColor: b.color }}
              >
                <BookOpen size={32} />
                <strong>{b.title}</strong>
              </div>
              <h3>{b.title}</h3>
              <small>
                <LockKeyhole size={12} />
                Verschlüsselt ·{" "}
                {new Date(b.createdAt).toLocaleDateString("de-DE")}
              </small>
            </button>
            {trash ? (
              <button
                disabled={busy}
                onClick={() => void run(() => vault.restoreBook(b.id))}
              >
                Buchprojekt wiederherstellen
              </button>
            ) : (
              <button
                disabled={busy}
                aria-label={`${b.title} Buchprojekt löschen`}
                onClick={() => {
                  if (
                    confirm(
                      "Dieses Buchprojekt samt Kapiteln und Szenen in den Papierkorb verschieben?",
                    )
                  )
                    void run(() => vault.trashBook(b.id));
                }}
              >
                <Trash2 size={15} />
                In den Papierkorb
              </button>
            )}
          </article>
        ))}
      </div>
      {!visible.length && (
        <p>
          {trash
            ? "Keine Buchprojekte im Papierkorb."
            : query
              ? "Keine passenden Bücher."
              : "Dein erstes Kapitel wartet. Erstelle ein leeres Buchprojekt und beginne mit deiner Geschichte."}
        </p>
      )}
      {create && (
        <BookProjectDialog
          onClose={() => setCreate(false)}
          onSave={async (meta, cover) => {
            const id = await vault.createBook(
              meta.title,
              meta,
              cover || undefined,
            );
            if (!vault.unlocked)
              throw new Error(
                "Der Tresor wurde inzwischen gesperrt. Das gespeicherte Projekt bleibt erhalten.",
              );
            onChanged();
            onOpen(id);
          }}
        />
      )}
    </section>
  );
}
