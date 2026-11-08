import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { closeHistory } from '@tiptap/pm/history';
import { searchKey } from './search-editor';
type Match = { from: number; to: number };
export default function SearchPanel({
  editor,
  version,
  onClose,
}: {
  editor: Editor;
  version: unknown;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(''),
    [replacement, setReplacement] = useState(''),
    [regex, setRegex] = useState(false),
    [caseSensitive, setCaseSensitive] = useState(false),
    [matches, setMatches] = useState<Match[]>([]),
    [current, setCurrent] = useState(0),
    [busy, setBusy] = useState(false),
    [limited, setLimited] = useState(false),
    [error, setError] = useState('');
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    field.current?.focus();
    return () => {
      if (!editor.isDestroyed)
        editor.view.dispatch(editor.state.tr.setMeta(searchKey, { matches: [], current: 0 }));
    };
  }, [editor]);
  useEffect(() => {
    setBusy(!!query);
    setError('');
    setMatches([]);
    setCurrent(0);
    editor.view.dispatch(editor.state.tr.setMeta(searchKey, { matches: [], current: 0 }));
    if (!query) {
      setBusy(false);
      return;
    }
    let worker: Worker | undefined,
      deadline: ReturnType<typeof setTimeout> | undefined,
      live = true;
    const timer = setTimeout(() => {
      const blocks: { text: string; from: number }[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.isTextblock) {
          blocks.push({
            text: node.textBetween(0, node.content.size, '', '\uFFFC'),
            from: pos + 1,
          });
          return false;
        }
      });
      worker = new Worker(new URL('./search-worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        if (!live) return;
        if (e.data.ready) {
          worker?.postMessage({ blocks, query, regex, caseSensitive });
          deadline = setTimeout(() => {
            worker?.terminate();
            setError(
              'Der Ausdruck benötigt zu lange. Bitte vereinfache ihn; die Suche wurde sicher abgebrochen.',
            );
            setBusy(false);
          }, 200);
          return;
        }
        clearTimeout(deadline);
        if (e.data.error) setError(e.data.error);
        else {
          setMatches(e.data.result.matches);
          setLimited(e.data.result.limited);
        }
        setBusy(false);
        worker?.terminate();
      };
      worker.onerror = () => {
        clearTimeout(deadline);
        setError('Die Suche konnte nicht ausgeführt werden. Bitte ändere die Suchanfrage.');
        setBusy(false);
      };
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
      clearTimeout(deadline);
      worker?.terminate();
    };
  }, [query, regex, caseSensitive, version, editor]);
  useEffect(() => {
    editor.view.dispatch(editor.state.tr.setMeta(searchKey, { matches, current }));
  }, [matches, current, editor]);
  const go = (direction: number) => {
    if (!matches.length) return;
    const next = (current + direction + matches.length) % matches.length;
    setCurrent(next);
    editor.chain().setTextSelection(matches[next]).scrollIntoView().run();
  };
  const replace = (all: boolean) => {
    if (busy || !matches.length || limited) return;
    const selected = all ? matches : [matches[current]];
    const tr = closeHistory(editor.state.tr);
    for (const match of [...selected].reverse()) {
      if (replacement) tr.insertText(replacement, match.from, match.to);
      else tr.delete(match.from, match.to);
    }
    editor.view.dispatch(tr);
  };
  return (
    <section
      className="search-panel"
      role="region"
      aria-label="Suchen und Ersetzen"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
          editor.commands.focus();
        }
        if (e.key === 'F3') {
          e.preventDefault();
          go(e.shiftKey ? -1 : 1);
        }
      }}
    >
      <div className="panel-heading">
        <strong>Suchen & Ersetzen</strong>
        <button aria-label="Suche schließen" onClick={onClose}>
          ×
        </button>
      </div>
      <label className="field-label">
        Suchen
        <input
          className="text-input"
          ref={field}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              go(e.shiftKey ? -1 : 1);
            }
          }}
        />
      </label>
      <label className="field-label">
        Ersetzen durch
        <input
          className="text-input"
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={caseSensitive}
          onChange={(e) => setCaseSensitive(e.target.checked)}
        />
        Groß-/Kleinschreibung
      </label>
      <label>
        <input type="checkbox" checked={regex} onChange={(e) => setRegex(e.target.checked)} />
        Regulärer Ausdruck
      </label>
      <p role="status">
        {busy
          ? 'Wird durchsucht …'
          : `${matches.length ? current + 1 : 0} von ${matches.length}${limited ? ' (Trefferlimit erreicht)' : ''}`}
      </p>
      {error && <p role="alert">{error}</p>}
      {limited && (
        <p>
          Bitte grenze die Suche ein. Ersetzen ist bei unvollständiger Trefferliste deaktiviert.
        </p>
      )}
      <div className="search-buttons">
        <button disabled={busy || !matches.length} onClick={() => go(-1)}>
          Vorheriger Treffer
        </button>
        <button disabled={busy || !matches.length} onClick={() => go(1)}>
          Nächster Treffer
        </button>
        <button disabled={busy || limited || !matches.length} onClick={() => replace(false)}>
          Treffer ersetzen
        </button>
        <button
          disabled={busy || limited || !matches.length}
          className="primary-button"
          onClick={() => replace(true)}
        >
          Alle ersetzen
        </button>
      </div>
      <small>
        Enter / Umschalt+Enter: nächster / vorheriger Treffer. Ersetzung wird als Text eingefügt.
      </small>
    </section>
  );
}
