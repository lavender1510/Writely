import { bookNodeTitle } from "../core/book-model";
import { useNativeBack } from "./useNativeBack";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  Suspense,
  lazy,
} from "react";
import {
  ArrowLeft,
  BookOpen,
  Menu,
  Plus,
  LockKeyhole,
  Settings,
  History,
} from "lucide-react";
import type { Vault } from "../core/vault";
import type { BookRepository } from "../core/book-repository";
import type { BookProject, BookNode } from "../core/book-types";
import type { DocumentFile } from "../core/types";
import BookBinder, { BinderDrawer } from "./BookBinder";
import { BookDashboard, BookCards, BookOutline } from "./BookViews";
import {
  BookProjectDialog,
  BookEntryDialog,
  BookStatusDialog,
} from "./BookDialogs";
import BookVersions from "./BookVersions";
const SecureEditor = lazy(() => import("./SecureEditor"));
type View = "dashboard" | "cards" | "outline" | "trash";
export default function BookWorkspace({
  vault,
  id,
  onExit,
  onRootChanged,
  onLock,
  onBackup,
  registerFlush,
}: {
  vault: Vault;
  id: string;
  onExit: () => void;
  onRootChanged: () => void;
  onLock: () => void;
  onBackup: () => void;
  registerFlush: (fn: (() => Promise<void>) | null) => void;
}) {
  const repo = useRef<BookRepository | null>(null),
    current = useRef<DocumentFile | null>(null),
    dirty = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    working = useRef(false),
    alive = useRef(true);
  const [project, setProject] = useState<BookProject | null>(null),
    [document, setDocument] = useState<DocumentFile | null>(null),
    [editorRevision, setEditorRevision] = useState(0),
    [cover, setCover] = useState<string | null>(null),
    [view, setView] = useState<View>("dashboard"),
    [group, setGroup] = useState<string | null>(null),
    [drawer, setDrawer] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Verschlüsselt gespeichert"),
    [dialog, setDialog] = useState<
      null | "project" | "new" | "versions" | "statuses"
    >(null),
    [editNode, setEditNode] = useState<BookNode | null>(null);
  const reload = useCallback(() => {
    if (alive.current && repo.current) setProject(repo.current.data());
  }, []);
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const r = repo.current,
      snapshot = current.current;
    if (!r) return;
    if (!dirty.current || !snapshot) {
      await r.idle();
      return;
    }
    await r.putDocument(snapshot);
    if (current.current === snapshot) dirty.current = false;
    if (alive.current) {
      setStatus(
        dirty.current
          ? "Weitere Änderungen werden gesichert …"
          : "Verschlüsselt gespeichert",
      );
      setProject(r.data());
      if (r.warning()) setError(r.warning());
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    registerFlush(flush);
    let live = true;
    void vault
      .openBook(id)
      .then(async (r) => {
        if (!live || !vault.unlocked) return;
        repo.current = r;
        setProject(r.data());
        if (r.data().cover) {
          const cover = await r.readCover();
          if (live) setCover(cover);
        }
      })
      .catch((e) => {
        if (live) setError((e as Error).message);
      });
    return () => {
      live = false;
      alive.current = false;
      clearTimeout(timer.current);
      registerFlush(null);
    };
  }, [id, vault, registerFlush, flush]);
  const perform = async <T,>(job: () => Promise<T>): Promise<T> => {
    if (working.current)
      throw new Error("Ein Projektvorgang läuft bereits. Bitte warte kurz.");
    working.current = true;
    setBusy(true);
    setError("");
    try {
      return await job();
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const run = (job: () => Promise<void>) => {
    void perform(job).catch((e) => {
      if (alive.current) setError((e as Error).message);
    });
  };
  const dashboard = async () => {
    await flush();
    current.current = null;
    setDocument(null);
    setView("dashboard");
    setDrawer(false);
  };
  const exit = async () => {
    await flush();
    await vault.closeBook(id);
    repo.current = null;
    current.current = null;
    onExit();
  };
  useNativeBack(
    300,
    () => {
      if (!(dialog || editNode || drawer)) return false;
      if (!working.current) {
        setDialog(null);
        setEditNode(null);
        setDrawer(false);
      }
      return true;
    },
    true,
  );
  useNativeBack(100, () => {
    if (working.current) return true;
    if (current.current) {
      run(dashboard);
      return true;
    }
    if (view !== "dashboard") {
      setView("dashboard");
      return true;
    }
    run(exit);
    return true;
  });

  const changed = (d: DocumentFile) => {
    current.current = d;
    dirty.current = true;
    setDocument(d);
    setStatus("Änderungen werden verschlüsselt gesichert …");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush().catch((e) => {
        if (alive.current) setError((e as Error).message);
      });
    }, 1000);
  };
  const load = async (nodeId: string) => {
    const r = repo.current!,
      node = r.data().nodes.find((n) => n.id === nodeId && !n.deletedAt);
    if (!node)
      throw new Error("Dieser Eintrag fehlt oder liegt im Papierkorb.");
    if (!node.document) {
      current.current = null;
      setDocument(null);
      setGroup(node.id);
      setView("cards");
      setDrawer(false);
      return;
    }
    const d = await r.readDocument(nodeId);
    current.current = d;
    dirty.current = false;
    setDocument(d);
    setEditorRevision((n) => n + 1);
    setDrawer(false);
    setStatus("Verschlüsselt gespeichert");
  };
  const open = (nodeId: string) =>
    run(async () => {
      await flush();
      await load(nodeId);
    });
  const changeView = (next: View) =>
    run(async () => {
      await flush();
      current.current = null;
      setDocument(null);
      setView(next);
      setDrawer(false);
    });
  const mutate = (job: (r: BookRepository) => Promise<unknown>) =>
    run(async () => {
      await flush();
      await job(repo.current!);
      reload();
    });
  if (!project)
    return (
      <section className="book-loading">
        <p role="status">
          {error
            ? "Buchprojekt konnte nicht geöffnet werden."
            : "Buchprojekt wird geöffnet …"}
        </p>
        {error && <p role="alert">{error}</p>}
        <button onClick={() => run(exit)}>Zur Bücherübersicht</button>
      </section>
    );
  const currentNode = project.nodes.find((n) => n.id === document?.id),
    parent =
      currentNode?.kind === "scene"
        ? currentNode.parentId
        : currentNode?.id || group;
  const newEntry = () => {
    setEditNode(null);
    setDialog("new");
    setDrawer(false);
  };
  const binder = (
    <BookBinder
      project={project}
      selected={document?.id || group || undefined}
      busy={busy}
      onOpen={open}
      onEdit={(n) => {
        setEditNode(n);
        setDrawer(false);
      }}
      onNew={newEntry}
      onMove={(nodeId, p, index) => mutate((r) => r.moveNode(nodeId, p, index))}
    />
  );
  const viewProps = {
    project,
    busy,
    onOpen: open,
    onEdit: (n: BookNode) => setEditNode(n),
    onMove: (nodeId: string, p: string | null, index: number) =>
      mutate((r) => r.moveNode(nodeId, p, index)),
    onDuplicate: (nodeId: string) => mutate((r) => r.duplicateNode(nodeId)),
    onTrash: (nodeId: string) => {
      if (
        confirm(
          "Diesen Eintrag samt aktiven Untereinträgen in den Projektpapierkorb verschieben?",
        )
      )
        mutate((r) => r.trashNode(nodeId));
    },
    onRestore: (nodeId: string) => mutate((r) => r.restoreNode(nodeId)),
  };
  return (
    <section className="book-workspace">
      <header className="book-workspace-bar">
        <button
          aria-label="Zur Bücherübersicht"
          disabled={busy}
          onClick={() => run(exit)}
        >
          <ArrowLeft size={19} />
        </button>
        <button
          className="book-binder-toggle"
          aria-label="Manuskript-Navigation öffnen"
          onClick={() => setDrawer(true)}
        >
          <Menu size={19} />
        </button>
        <button className="book-project-title" onClick={() => run(dashboard)}>
          <BookOpen size={16} />
          <span>{project.title}</span>
        </button>
        <button
          aria-label="Buchprojekt bearbeiten"
          disabled={busy}
          onClick={() => setDialog("project")}
        >
          <Settings size={18} />
        </button>
        <button aria-label="Tresor jetzt sperren" onClick={onLock}>
          <LockKeyhole size={17} />
        </button>
      </header>
      {error && (
        <p role="alert" className="book-error">
          {error}
          <button onClick={() => setError("")}>Meldung schließen</button>
        </p>
      )}
      <div className="book-workspace-body">
        <aside className="book-desktop-binder">{binder}</aside>
        <main className="book-main">
          {document ? (
            <Suspense
              fallback={<p role="status">Kapitel wird vorbereitet …</p>}
            >
              <SecureEditor
                backLabel="Zur Projektübersicht"
                key={`${document.id}:${editorRevision}`}
                document={document}
                onBack={() => run(dashboard)}
                status={busy ? "Projekt wird aktualisiert …" : status}
                onChange={changed}
                onSave={async (kind, name, d) => {
                  await flush();
                  await vault.saveTemplate(kind, name, d);
                  onRootChanged();
                }}
                actions={
                  <>
                    <button
                      onClick={() =>
                        run(async () => {
                          await flush();
                        })
                      }
                    >
                      Kapitel speichern
                    </button>
                    <button onClick={() => run(dashboard)}>
                      Projektübersicht
                    </button>
                    <button
                      onClick={() =>
                        run(async () => {
                          await flush();
                          setDialog("versions");
                        })
                      }
                    >
                      <History size={16} />
                      Kapitelversionen
                    </button>
                    <button onClick={onBackup}>
                      Verschlüsseltes Bibliotheks-Backup
                    </button>
                    <button onClick={onLock}>Tresor sperren</button>
                  </>
                }
              />
            </Suspense>
          ) : (
            <>
              <nav className="book-view-tabs" aria-label="Projektansichten">
                {(
                  [
                    ["dashboard", "Übersicht"],
                    ["cards", "Karteikarten"],
                    ["outline", "Gliederung"],
                    ["trash", "Projektpapierkorb"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    disabled={busy}
                    aria-pressed={view === id}
                    onClick={() => changeView(id)}
                  >
                    {label}
                  </button>
                ))}
                <button disabled={busy} onClick={newEntry}>
                  <Plus size={15} />
                  Neuer Eintrag
                </button>
                <button disabled={busy} onClick={() => setDialog("statuses")}>
                  Status verwalten
                </button>
              </nav>
              <div className="book-view-content">
                {view === "dashboard" ? (
                  <BookDashboard
                    project={project}
                    cover={cover}
                    onResume={open}
                    onNew={newEntry}
                  />
                ) : view === "outline" ? (
                  <BookOutline {...viewProps} />
                ) : (
                  <>
                    {view === "cards" && (
                      <label className="book-group-filter">
                        Karteikarten in
                        <select
                          aria-label="Karteikarten filtern"
                          value={group || ""}
                          onChange={(e) => setGroup(e.target.value || null)}
                        >
                          <option value="">Alle Einträge</option>
                          {project.nodes
                            .filter((n) => !n.deletedAt && n.kind !== "scene")
                            .map((n) => (
                              <option key={n.id} value={n.id}>
                                {bookNodeTitle(n)}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                    <BookCards
                      {...viewProps}
                      trash={view === "trash"}
                      group={group}
                    />
                  </>
                )}
              </div>
              <p className="book-status" role="status">
                {busy ? "Projekt wird verarbeitet …" : status}
              </p>
            </>
          )}
        </main>
      </div>
      {drawer && (
        <BinderDrawer onClose={() => setDrawer(false)}>{binder}</BinderDrawer>
      )}
      {dialog === "project" && (
        <BookProjectDialog
          project={project}
          coverSrc={cover}
          onClose={() => setDialog(null)}
          onSave={async (meta, image) => {
            await perform(async () => {
              await flush();
              await repo.current!.updateMetadata(meta, image);
              await vault.renameBook(id, meta.title, meta.color);
              setCover(await repo.current!.readCover());
              reload();
              onRootChanged();
            });
          }}
        />
      )}
      {(dialog === "new" || editNode) && (
        <BookEntryDialog
          project={project}
          initial={editNode || undefined}
          parent={parent}
          onClose={() => {
            setDialog(null);
            setEditNode(null);
          }}
          onSave={async (value) => {
            await perform(async () => {
              await flush();
              if (editNode) {
                await repo.current!.updateNode(
                  editNode.id,
                  value,
                  value.parentId,
                );
                reload();
                if (current.current?.id === editNode.id) {
                  const d = await repo.current!.readDocument(editNode.id);
                  current.current = d;
                  setDocument(d);
                }
              } else {
                const nodeId = await repo.current!.createNode(
                  value.kind,
                  value.title,
                  value.parentId,
                  value,
                );
                reload();
                await load(nodeId);
              }
            });
          }}
        />
      )}
      {dialog === "versions" && currentNode && repo.current && (
        <BookVersions
          repo={repo.current}
          node={currentNode}
          onClose={() => setDialog(null)}
          onCaptured={reload}
          onRestored={async () => {
            reload();
            await load(currentNode.id);
          }}
        />
      )}
      {dialog === "statuses" && (
        <BookStatusDialog
          project={project}
          onClose={() => setDialog(null)}
          onSave={async (status, label, color) => {
            await perform(async () => {
              await flush();
              await repo.current!.saveStatus(status, label, color);
              reload();
            });
          }}
        />
      )}
    </section>
  );
}
