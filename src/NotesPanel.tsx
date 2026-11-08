import { useState,useRef } from 'react';
import {useDialogFocus} from './dialog-focus';
import { closeHistory } from '@tiptap/pm/history';
import type { Editor } from '@tiptap/react';
export function NoteDialog({
  editor,
  kind,
  onClose,
}: {
  editor: Editor;
  kind: 'footnote' | 'endnote';
  onClose: () => void;
}) {
  const dialogRef=useRef<HTMLFormElement>(null);useDialogFocus(dialogRef,onClose);
  const attrs = editor.isActive('note') ? editor.getAttributes('note') : null;
  const [text, setText] = useState(attrs?.text || '');
  const [type, setType] = useState(kind);
  return (
    <div className="modal-backdrop">
      <form
        ref={dialogRef} className="modal"
        role="dialog"
        aria-label="Note bearbeiten"
        aria-modal="true"
        onSubmit={(e) => {
          e.preventDefault();
          editor
            .chain()
            .focus()
            .command(({ tr }) => {
              closeHistory(tr);
              return true;
            })
            .insertContent({
              type: 'note',
              attrs: { id: attrs?.id || 'w-' + crypto.randomUUID(), kind: type, text },
            })
            .run();
          onClose();
        }}
      >
        <div className="modal-title">
          <h2>{attrs ? 'Note bearbeiten' : 'Note einfügen'}</h2>
          <button type="button" onClick={onClose}>
            Schließen
          </button>
        </div>
        <label className="field-label">
          Notentyp
          <select
            className="wide-select"
            aria-label="Notentyp"
            value={type}
            onChange={(e) => setType(e.target.value as typeof kind)}
          >
            <option value="footnote">Fußnote</option>
            <option value="endnote">Endnote</option>
          </select>
        </label>
        <label className="field-label">
          Notentext
          <textarea
            autoFocus
            className="text-input"
            rows={6}
            maxLength={20000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <p>
          Nummerierung wird automatisch aktualisiert. Notentexte werden als Klartext gespeichert.
        </p>
        <div className="modal-actions">
          {attrs && (
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().deleteSelection().run();
                onClose();
              }}
            >
              Note entfernen
            </button>
          )}
          <button className="primary-button">Note übernehmen</button>
        </div>
      </form>
    </div>
  );
}
export function NotesList({
  editor,
  onEdit,
}: {
  editor: Editor | null;
  onEdit: (kind: 'footnote' | 'endnote') => void;
}) {
  const notes: { pos: number; kind: 'footnote' | 'endnote'; text: string; number: number }[] = [],
    counts = { footnote: 0, endnote: 0 };
  editor?.state.doc.descendants((node, pos) => {
    if (node.type.name === 'note') {
      const kind = node.attrs.kind as 'footnote' | 'endnote';
      notes.push({ pos, kind, text: node.attrs.text, number: ++counts[kind] });
    }
  });
  if (!notes.length) return null;
  return (
    <section className="notes-list" aria-label="Dokumentnoten">
      <h3>Fuß- & Endnoten</h3>
      {notes.map((n) => (
        <button
          key={n.pos}
          onClick={() => {
            editor?.chain().setNodeSelection(n.pos).run();
            onEdit(n.kind);
          }}
        >
          <strong>
            {n.kind === 'footnote' ? 'Fußnote' : 'Endnote'} {n.number}
          </strong>
          <span>{n.text || 'Leere Note'}</span>
        </button>
      ))}
    </section>
  );
}
