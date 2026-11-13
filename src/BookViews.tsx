import { useMemo, useState } from "react";
import { FileText, MoreHorizontal, ArrowUp, ArrowDown } from "lucide-react";
import {
  bookStats,
  bookWordTotals,
  bookManuscriptNodes,
  bookNodeTitle,
} from "../core/book-model";
import type { BookProject, BookNode } from "../core/book-types";
import { kindNames } from "./BookDialogs";
import { bookDrag, readBookDrag } from "./BookBinder";
function StatusBadge({ project, id }: { project: BookProject; id: string }) {
  const status = project.statuses.find((s) => s.id === id);
  return (
    <span className="book-status-badge">
      <i aria-hidden="true" style={{ backgroundColor: status?.color }} />
      {status?.label}
    </span>
  );
}
export function BookDashboard({
  project,
  cover,
  onResume,
  onNew,
}: {
  project: BookProject;
  cover: string | null;
  onResume: (id: string) => void;
  onNew: () => void;
}) {
  const stats = bookStats(project),
    last = project.nodes.find(
      (n) => n.id === project.lastNodeId && !n.deletedAt,
    ),
    progress = project.goalWords
      ? Math.min(100, (100 * stats.words) / project.goalWords)
      : 0;
  return (
    <section className="book-dashboard" aria-label="Projektübersicht">
      <div className="book-hero" style={{ borderColor: project.color }}>
        {cover && <img src={cover} alt={project.cover?.alt || "Buchcover"} />}
        <div>
          <span className="secure-eyebrow">DEIN BUCHPROJEKT</span>
          <h1>{project.title}</h1>
          {project.subtitle && <p>{project.subtitle}</p>}
          <p>
            {project.pseudonym ||
              project.author ||
              "Ein eigener Ort für deine Geschichte."}
          </p>
        </div>
      </div>
      <div className="book-metrics">
        <div>
          <strong>{stats.words.toLocaleString("de-DE")}</strong>
          <span>Wörter im Manuskript</span>
        </div>
        <div>
          <strong>{stats.chapters}</strong>
          <span>Kapitel</span>
        </div>
        <div>
          <strong>{stats.scenes}</strong>
          <span>Szenen</span>
        </div>
      </div>
      {project.goalWords > 0 && (
        <label className="book-progress">
          Projektziel: {stats.words.toLocaleString("de-DE")} von{" "}
          {project.goalWords.toLocaleString("de-DE")} Wörtern
          <progress
            max={100}
            value={progress}
            style={{ accentColor: project.color }}
          />
        </label>
      )}
      <div className="book-dashboard-actions">
        {last?.document && (
          <button className="primary-button" onClick={() => onResume(last.id)}>
            Weiterschreiben: {bookNodeTitle(last)}
          </button>
        )}
        <button className="secondary-button" onClick={onNew}>
          Kapitel oder Szene hinzufügen
        </button>
      </div>
      {project.description && (
        <p className="book-description">{project.description}</p>
      )}
      <p className="book-scope">
        Manuskripttexte werden einzeln gespeichert. Zusammenfassungen und
        private Notizen bleiben Teil der Projektplanung. Buchdesigner und
        Gesamtexport folgen als getrennt geprüfter Entwicklungsschritt.
      </p>
    </section>
  );
}
interface ViewProps {
  project: BookProject;
  busy: boolean;
  onOpen: (id: string) => void;
  onEdit: (node: BookNode) => void;
  onMove: (id: string, parent: string | null, index: number) => void;
  onDuplicate: (id: string) => void;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
}
export function BookCards({
  project,
  busy,
  onOpen,
  onEdit,
  onMove,
  onDuplicate,
  onTrash,
  onRestore,
  trash = false,
  group = null,
}: ViewProps & { trash?: boolean; group?: string | null }) {
  const [limit, setLimit] = useState(40),
    totals = useMemo(() => bookWordTotals(project), [project.nodes]),
    nodes = trash
      ? project.nodes.filter((n) => n.deletedAt)
      : bookManuscriptNodes(project).filter(
          (n) => group === null || n.parentId === group,
        ),
    [error, setError] = useState("");
  const step = (n: BookNode, delta: number) => {
    const siblings = project.nodes
      .filter((x) => !x.deletedAt && x.parentId === n.parentId)
      .sort((a, b) => a.order - b.order);
    onMove(
      n.id,
      n.parentId,
      Math.max(
        0,
        Math.min(
          siblings.length - 1,
          siblings.findIndex((x) => x.id === n.id) + delta,
        ),
      ),
    );
  };
  return (
    <section
      className="book-cards-view"
      aria-label={trash ? "Projektpapierkorb" : "Karteikarten"}
    >
      {error && <p role="alert">{error}</p>}
      <div className="book-cards">
        {nodes.slice(0, limit).map((n) => (
          <article
            key={n.id}
            style={{ borderTopColor: n.color }}
            draggable={!trash && !busy}
            onDragStart={(e) => bookDrag(e, project, n)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (trash) return;
              try {
                const source=readBookDrag(e,project);if(source===n.id)return;
                onMove(
                  source,
                  n.parentId,
                  project.nodes
                    .filter((x) => x.parentId === n.parentId && !x.deletedAt && x.id!==source)
                    .sort((a, b) => a.order - b.order)
                    .findIndex((x) => x.id === n.id),
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <small>
              {kindNames[n.kind]} ·{" "}
              {<StatusBadge project={project} id={n.statusId} />}
            </small>
            <button
              className="book-card-open"
              disabled={busy || trash}
              onClick={() => onOpen(n.id)}
            >
              <h3>{bookNodeTitle(n)}</h3>
              <p>{n.synopsis || "Noch keine Zusammenfassung."}</p>
            </button>
            <small>
              {n.parentId
                ? bookNodeTitle(project.nodes.find((x) => x.id === n.parentId))
                : "Manuskript"}{" "}
              · {totals.get(n.id) || 0} Wörter
            </small>
            <footer>
              {trash ? (
                <button disabled={busy} onClick={() => onRestore(n.id)}>
                  Eintrag wiederherstellen
                </button>
              ) : (
                <>
                  <button
                    disabled={busy}
                    aria-label={`${bookNodeTitle(n)} bearbeiten`}
                    onClick={() => onEdit(n)}
                  >
                    <MoreHorizontal size={17} />
                  </button>
                  <button
                    disabled={busy}
                    aria-label={`${bookNodeTitle(n)} nach oben`}
                    onClick={() => step(n, -1)}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    disabled={busy}
                    aria-label={`${bookNodeTitle(n)} nach unten`}
                    onClick={() => step(n, 1)}
                  >
                    <ArrowDown size={15} />
                  </button>
                  <button disabled={busy} onClick={() => onDuplicate(n.id)}>
                    Kopie
                  </button>
                  <button disabled={busy} onClick={() => onTrash(n.id)}>
                    Papierkorb
                  </button>
                </>
              )}
            </footer>
          </article>
        ))}
      </div>
      {nodes.length > limit && (
        <button
          className="secondary-button"
          onClick={() => setLimit((n) => n + 40)}
        >
          Weitere Karteikarten
        </button>
      )}
      {!nodes.length && (
        <p>
          {trash
            ? "Der Projektpapierkorb ist leer."
            : "Noch keine passenden Manuskripteinträge."}
        </p>
      )}
    </section>
  );
}
export function BookOutline(props: ViewProps) {
  const { project, busy, onOpen, onEdit } = props,
    [columns, setColumns] = useState(["kind", "status", "words", "synopsis"]),
    [page, setPage] = useState(0),
    totals = useMemo(() => bookWordTotals(project), [project.nodes]);
  const nodes = bookManuscriptNodes(project),
    pages = Math.max(1, Math.ceil(nodes.length / 40)),
    current = Math.min(page, pages - 1),
    rows = nodes.slice(current * 40, current * 40 + 40);
  return (
    <section className="book-outline" aria-label="Gliederungsansicht">
      <fieldset>
        <legend>Sichtbare Spalten</legend>
        {[
          ["kind", "Art"],
          ["parent", "Übergeordnet"],
          ["status", "Status"],
          ["words", "Wörter"],
          ["synopsis", "Zusammenfassung"],
        ].map(([id, label]) => (
          <label key={id}>
            <input
              type="checkbox"
              checked={columns.includes(id)}
              onChange={(e) =>
                setColumns((c) =>
                  e.target.checked ? [...c, id] : c.filter((x) => x !== id),
                )
              }
            />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="book-outline-table">
        <table>
          <thead>
            <tr>
              <th>Titel</th>
              {columns.includes("kind") && <th>Art</th>}
              {columns.includes("parent") && <th>Übergeordnet</th>}
              {columns.includes("status") && <th>Status</th>}
              {columns.includes("words") && <th>Wörter inkl. Szenen</th>}
              {columns.includes("synopsis") && <th>Zusammenfassung</th>}
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.id}>
                <td>
                  <button disabled={busy} onClick={() => onOpen(n.id)}>
                    <FileText size={14} />
                    {bookNodeTitle(n)}
                  </button>
                </td>
                {columns.includes("kind") && <td>{kindNames[n.kind]}</td>}
                {columns.includes("parent") && (
                  <td>
                    {bookNodeTitle(
                      project.nodes.find((x) => x.id === n.parentId),
                    )}
                  </td>
                )}
                {columns.includes("status") && (
                  <td>{<StatusBadge project={project} id={n.statusId} />}</td>
                )}
                {columns.includes("words") && <td>{totals.get(n.id) || 0}</td>}
                {columns.includes("synopsis") && <td>{n.synopsis}</td>}
                <td>
                  <button
                    disabled={busy}
                    aria-label={`${bookNodeTitle(n)} bearbeiten`}
                    onClick={() => onEdit(n)}
                  >
                    Bearbeiten
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="book-pagination">
        <button disabled={!current} onClick={() => setPage((n) => n - 1)}>
          Zurück
        </button>
        <span>
          {current + 1} von {pages} · {nodes.length} Einträge
        </span>
        <button
          disabled={current >= pages - 1}
          onClick={() => setPage((n) => n + 1)}
        >
          Weiter
        </button>
      </div>
    </section>
  );
}
