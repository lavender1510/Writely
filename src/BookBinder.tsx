import { bookNodeTitle } from "../core/book-model";
import { useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  FileText,
  Folder,
  Plus,
} from "lucide-react";
import type { BookProject, BookNode } from "../core/book-types";
import { useDialogFocus } from "./dialog-focus";
export function readBookDrag(e: React.DragEvent, project: BookProject) {
  const text = e.dataTransfer.getData("application/x-writely-book-node");
  if (!text) throw new Error("Kein Manuskripteintrag ausgewählt.");
  const value = JSON.parse(text);
  if (value.projectId !== project.id || typeof value.id !== "string")
    throw new Error(
      "Einträge können nur innerhalb dieses Buchprojekts verschoben werden.",
    );
  return value.id as string;
}
export function bookDrag(
  e: React.DragEvent,
  project: BookProject,
  node: BookNode,
) {
  e.dataTransfer.setData(
    "application/x-writely-book-node",
    JSON.stringify({ projectId: project.id, id: node.id }),
  );
}
export default function BookBinder({
  project,
  selected,
  busy,
  onOpen,
  onEdit,
  onNew,
  onMove,
}: {
  project: BookProject;
  selected?: string;
  busy: boolean;
  onOpen: (id: string) => void;
  onEdit: (n: BookNode) => void;
  onNew: () => void;
  onMove: (id: string, parent: string | null, index: number) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set()),
    [scroll, setScroll] = useState(0),
    [error, setError] = useState(""),
    viewport = useRef<HTMLDivElement>(null);
  const { rows, children } = useMemo(() => {
    const children = new Map<string | null, BookNode[]>();
    for (const n of project.nodes)
      if (!n.deletedAt) {
        const values = children.get(n.parentId) || [];
        values.push(n);
        children.set(n.parentId, values);
      }
    for (const values of children.values())
      values.sort((a, b) => a.order - b.order);
    const rows: { node: BookNode; depth: number }[] = [];
    const visit = (parent: string | null, depth: number) => {
      for (const n of children.get(parent) || []) {
        rows.push({ node: n, depth });
        if (!collapsed.has(n.id)) visit(n.id, depth + 1);
      }
    };
    visit(null, 0);
    return { rows, children };
  }, [project.nodes, collapsed]);
  const start = Math.min(
      Math.max(0, Math.floor(scroll / 46) - 5),
      Math.max(0, rows.length - 1),
    ),
    visible = rows.slice(start, start + 24);
  const drop = (e: React.DragEvent, n: BookNode, inside: boolean) => {
    e.preventDefault();
    try {
      const id = readBookDrag(e, project),
        siblings = (children.get(n.parentId) || []).filter(x=>x.id!==id);
      if(id===n.id)return;
      onMove(
        id,
        inside ? n.id : n.parentId,
        inside
          ? (children.get(n.id) || []).length
          : siblings.findIndex((x) => x.id === n.id),
      );
    } catch (error) {
      setError((error as Error).message);
    }
  };
  return (
    <nav className="book-binder" aria-label="Manuskriptorganisation">
      <header>
        <strong>Manuskript</strong>
        <button
          disabled={busy}
          aria-label="Manuskripteintrag hinzufügen"
          onClick={onNew}
        >
          <Plus size={17} />
        </button>
      </header>
      <div
        className="book-binder-scroll"
        ref={viewport}
        tabIndex={0}
        aria-label="Manuskript scrollen"
        onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
      >
        <div
          className="book-binder-items"
          role="list"
          style={{ height: rows.length * 46 }}
        >
          {visible.map(({ node: n, depth }, index) => (
            <div
              role="listitem"
              aria-posinset={start + index + 1}
              aria-setsize={rows.length}
              key={n.id}
              className="book-binder-row"
              style={{
                top: (start + index) * 46,
                paddingLeft: Math.min(depth, 8) * 14,
              }}
              draggable={!busy}
              onDragStart={(e) => bookDrag(e, project, n)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => drop(e, n, n.kind !== "scene")}
            >
              <div
                className="book-drop-before"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.stopPropagation();
                  drop(e, n, false);
                }}
              />
              {(children.get(n.id)?.length || 0) > 0 ? (
                <button
                  disabled={busy}
                  aria-label={`${bookNodeTitle(n)} ${collapsed.has(n.id) ? "aufklappen" : "einklappen"}`}
                  onClick={() =>
                    setCollapsed((values) => {
                      const next = new Set(values);
                      next.has(n.id) ? next.delete(n.id) : next.add(n.id);
                      return next;
                    })
                  }
                >
                  {collapsed.has(n.id) ? (
                    <ChevronRight size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                </button>
              ) : (
                <span className="book-binder-spacer" />
              )}
              <button
                className="book-binder-title"
                disabled={busy}
                aria-current={selected === n.id ? "page" : undefined}
                title={bookNodeTitle(n)}
                onClick={() => onOpen(n.id)}
              >
                {n.document ? <FileText size={14} /> : <Folder size={14} />}
                <span>{bookNodeTitle(n)}</span>
              </button>
              <button
                disabled={busy}
                aria-label={`${bookNodeTitle(n)} bearbeiten`}
                onClick={() => onEdit(n)}
              >
                <MoreHorizontal size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      {!rows.length && (
        <p>Noch keine Kapitel. Dein Manuskript beginnt mit einem Eintrag.</p>
      )}
      <small>
        {rows.length} sichtbare Einträge · Kapitel werden einzeln geladen
      </small>
    </nav>
  );
}
export function BinderDrawer({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(ref, onClose);
  return (
    <div className="modal-backdrop book-drawer-backdrop" onClick={onClose}>
      <aside
        className="book-drawer"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Manuskript-Navigation"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose}>Navigation schließen</button>
        {children}
      </aside>
    </div>
  );
}
