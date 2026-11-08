import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { closeHistory } from '@tiptap/pm/history';
import { getApi } from './browser';
import { proofingKey } from './proofing-editor';
const api = getApi();
export type ProofingPreferences = { language: 'de-DE' | 'en-US'; enabled: boolean };
export default function ProofingTools({
  editor,
  version,
  value,
  onChange,
  visible,
}: {
  visible: boolean;
  editor: Editor | null;
  version: unknown;
  value: ProofingPreferences;
  onChange: (v: ProofingPreferences) => void;
}) {
  const [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [menu, setMenu] = useState<{
      x: number;
      y: number;
      word: string;
      from: number;
      to: number;
      suggestions: string[];
    } | null>(null),
    [tick, setTick] = useState(0);
  const cache = useRef(new Map<string, boolean>());
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cache.current.clear();
    setMenu(null);
  }, [value.language, tick]);
  useEffect(() => {
    if (!editor) return;
    editor.view.dom.setAttribute('spellcheck', 'false');
    editor.view.dom.setAttribute('lang', value.language);
    if (!value.enabled || !api.spellCheck) {
      editor.view.dispatch(editor.state.tr.setMeta(proofingKey, []));
      setStatus(
        !api.spellCheck ? 'Offline-Wörterbücher: Desktop-App erforderlich.' : 'Prüfung deaktiviert',
      );
      return;
    }
    let live = true;
    setError('');
    const timer = setTimeout(async () => {
      const words: { word: string; from: number; to: number }[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.isTextblock && node.type.name !== 'codeBlock') {
          const text = node.textBetween(0, node.content.size, '', '\uFFFC');
          for (const match of text.matchAll(/[\p{L}\p{M}]+(?:[’'\-][\p{L}\p{M}]+)*/gu))
            if (match[0].length <= 80)
              words.push({
                word: match[0],
                from: pos + 1 + match.index!,
                to: pos + 1 + match.index! + match[0].length,
              });
          return false;
        }
      });
      const unknown = [...new Set(words.map((w) => w.word))].filter((w) => !cache.current.has(w));
      setStatus(unknown.length ? 'Wörterbuch wird geprüft …' : 'Lokal geprüft');
      try {
        for (let i = 0; i < unknown.length; i += 2000) {
          if (!live) return;
          const batch = unknown.slice(i, i + 2000),
            incorrect = new Set(await api.spellCheck!(value.language, batch));
          if (!live) return;
          batch.forEach((w) => cache.current.set(w, !incorrect.has(w)));
        }
        if (live) {
          editor.view.dispatch(
            editor.state.tr.setMeta(
              proofingKey,
              words.filter((w) => cache.current.get(w.word) === false),
            ),
          );
          setStatus('Lokal geprüft · ohne Upload');
        }
      } catch (e) {
        if (live) {
          setError((e as Error).message);
          setStatus('Prüfung nicht verfügbar');
        }
      }
    }, 650);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [editor, version, value.language, value.enabled, tick]);
  useEffect(() => {
    if (!editor) return;
    const open = async (event: MouseEvent | KeyboardEvent) => {
      if (!value.enabled) return;
      let from: number, to: number, word: string, x: number, y: number;
      if (event instanceof MouseEvent) {
        const target = (event.target as HTMLElement).closest('.spelling-error');
        if (!target) return;
        const pos = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        if (pos === undefined) return;
        const range = proofingKey
          .getState(editor.state)
          ?.find(pos, pos)
          .find((d) => d.from <= pos && d.to >= pos);
        if (!range) return;
        from = range.from;
        to = range.to;
        word = editor.state.doc.textBetween(from, to);
        x = event.clientX;
        y = event.clientY;
      } else {
        if (!(event.shiftKey && event.key === 'F10')) return;
        const pos = editor.state.selection.from,
          range = proofingKey.getState(editor.state)?.find(Math.max(0, pos - 1), pos + 1)[0];
        if (!range) return;
        from = range.from;
        to = range.to;
        word = editor.state.doc.textBetween(from, to);
        const rect = editor.view.coordsAtPos(from);
        x = rect.left;
        y = rect.bottom;
      }
      event.preventDefault();
      const selection = {
        x: Math.min(x, window.innerWidth - 280),
        y: Math.min(y, window.innerHeight - 330),
        word,
        from,
        to,
        suggestions: [] as string[],
      };
      setMenu(selection);
      try {
        const suggestions = (await api.spellSuggest?.(value.language, word)) || [];
        setMenu((current) =>
          current?.from === from && current.word === word ? { ...current, suggestions } : current,
        );
      } catch (e) {
        setError((e as Error).message);
      }
    };
    const onMouse = (e: MouseEvent) => {
        void open(e);
      },
      onKey = (e: KeyboardEvent) => {
        void open(e);
      };
    const dom = editor.view.dom;
    dom.addEventListener('contextmenu', onMouse);
    dom.addEventListener('keydown', onKey);
    return () => {
      dom.removeEventListener('contextmenu', onMouse);
      dom.removeEventListener('keydown', onKey);
    };
  }, [editor, value.language, value.enabled]);
  useEffect(() => {
    if (menu) requestAnimationFrame(() => menuRef.current?.querySelector('button')?.focus());
  }, [menu?.from, menu?.suggestions.length]);
  useEffect(() => {
    if (menu) setMenu(null);
  }, [version]);
  return (
    <>
      <div className="proofing-tools" style={{ display: visible ? 'flex' : 'none' }}>
        <label>
          Sprache
          <select
            aria-label="Dokumentsprache"
            value={value.language}
            onChange={(e) =>
              onChange({ ...value, language: e.target.value as ProofingPreferences['language'] })
            }
          >
            <option value="de-DE">Deutsch</option>
            <option value="en-US">English (US)</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
          />
          Offline-Rechtschreibung
        </label>
        <small role="status">{status}</small>
        {error && <span role="alert">{error}</span>}
      </div>
      {menu && (
        <div
          onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as globalThis.Node))setMenu(null);}} ref={menuRef}
          className="spelling-menu"
          role="menu"
          aria-label={`Korrekturen für ${menu.word}`}
          style={{ left: menu.x, top: menu.y }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setMenu(null);
              editor?.commands.focus();
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const buttons = [...e.currentTarget.querySelectorAll('button')],
                index = buttons.indexOf(document.activeElement as HTMLButtonElement);
              buttons[
                (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
              ]?.focus();
            }
          }}
        >
          <strong>{menu.word}</strong>
          {menu.suggestions.map((word) => (
            <button
              role="menuitem"
              key={word}
              onClick={() => {
                if (!editor) return;
                const tr = closeHistory(editor.state.tr.insertText(word, menu.from, menu.to));
                editor.view.dispatch(tr);
                setMenu(null);
                editor.commands.focus();
              }}
            >
              {word}
            </button>
          ))}
          {!menu.suggestions.length && <small>Keine Vorschläge geladen.</small>}
          <button
            role="menuitem"
            onClick={async () => {
              try {
                await api.dictionaryChange?.(value.language, menu.word, false);
                setTick((v) => v + 1);
                setMenu(null);
                editor?.commands.focus();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Zum Benutzerwörterbuch hinzufügen
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setMenu(null);
              editor?.commands.focus();
            }}
          >
            Schließen
          </button>
        </div>
      )}
    </>
  );
}
