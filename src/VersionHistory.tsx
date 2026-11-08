import { useEffect, useRef, useState } from 'react';
import {useDialogFocus} from './dialog-focus';
import { getApi } from './browser';
import { documentText } from './document';
import type { DocumentFile, VersionInfo, JSONContent } from './shared';
const api = getApi();
function PreviewNode({ node }: { node: JSONContent }) {
  const children = node.content?.map((n, i) => <PreviewNode node={n} key={i} />);
  if (node.type === 'text') {
    let value: any = node.text;
    for (const m of node.marks || []) {
      if (m.type === 'bold') value = <strong>{value}</strong>;
      if (m.type === 'italic') value = <em>{value}</em>;
      if (m.type === 'underline') value = <u>{value}</u>;
    }
    return value;
  }
  if (node.type === 'image') return <img src={node.attrs?.src} alt={node.attrs?.alt || ''} />;
  if (node.type === 'layoutBreak') return <hr />;
  if (node.type === 'hardBreak') return <br />;
  if (node.type === 'note') return <sup title={node.attrs?.text}>†</sup>;
  if (node.type === 'toc') return <p>{node.attrs?.title || 'Inhaltsverzeichnis'}</p>;
  const tag =
    node.type === 'heading'
      ? `h${node.attrs?.level || 1}`
      : (
          {
            paragraph: 'p',
            blockquote: 'blockquote',
            table: 'table',
            tableRow: 'tr',
            tableCell: 'td',
            tableHeader: 'th',
            bulletList: 'ul',
            orderedList: 'ol',
            listItem: 'li',
            codeBlock: 'pre',
          } as Record<string, string>
        )[node.type || ''] || 'div';
  const Tag = tag as any;
  return (
    <Tag colSpan={node.attrs?.colspan} rowSpan={node.attrs?.rowspan}>
      {children}
    </Tag>
  );
}
export default function VersionHistory({
  document,
  snapshot,
  onRestore,
  onClose,
}: {
  document: DocumentFile;
  snapshot: () => DocumentFile;
  onRestore: (d: DocumentFile) => void;
  onClose: () => void;
}) {
  const dialogRef=useRef<HTMLElement>(null);useDialogFocus(dialogRef,onClose);
  const [versions, setVersions] = useState<VersionInfo[]>([]),
    [preview, setPreview] = useState<DocumentFile | null>(null),
    [selected, setSelected] = useState(''),
    [busy, setBusy] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    api
      .autosave(snapshot())
      .then(() => api.versions(document.id))
      .then((v) => {
        if (live) setVersions(v);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [document.id]);
  const choose = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      if (!api.previewVersion) throw new Error('Versionsvorschau ist hier nicht verfügbar.');
      setPreview(await api.previewVersion(id, document.id));
      setSelected(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const restore = async () => {
    setBusy(true);
    setError('');
    try {
      await api.autosave(snapshot());
      const restored = await api.restoreVersion(selected, document.id);
      await api.autosave(restored);
      onRestore(restored);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <section
        ref={dialogRef} className="modal history-dialog"
        role="dialog"
        aria-label="Versionsverlauf"
        aria-modal="true"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <div className="modal-title">
          <div>
            <span className="eyebrow">NUR DIESES DOKUMENT</span>
            <h2>Dein Text. Mit Geschichte.</h2>
            <p>{document.title}</p>
          </div>
          <button autoFocus onClick={onClose}>
            Schließen
          </button>
        </div>
        {busy && <p role="status">Version wird geladen …</p>}
        {error && <p role="alert">{error}</p>}
        <div className="history-columns">
          <div className="versions-list">
            {versions.map((v) => (
              <button
                disabled={busy}
                className={selected === v.id ? 'selected' : ''}
                key={v.id}
                onClick={() => choose(v.id)}
              >
                <strong>{v.title}</strong>
                <small>{new Date(v.capturedAt || v.updatedAt).toLocaleString('de-DE')}</small>
              </button>
            ))}
            {!busy && !versions.length && <p>Keine Versionen für dieses Dokument.</p>}
          </div>
          <div>
            {preview ? (
              <>
                <h3>Schreibgeschützte Vorschau</h3>
                <article className="document-preview" aria-label="Versionsvorschau">
                  <PreviewNode node={preview.content} />
                </article>
                <p>
                  {documentText(preview.content).length.toLocaleString('de-DE')} Zeichen. Vor der
                  Wiederherstellung wird dein aktueller Arbeitsstand gesichert.
                </p>
                <button disabled={busy} className="primary-button" onClick={restore}>
                  Diese Version wiederherstellen
                </button>
              </>
            ) : (
              <p>
                Wähle eine Version zur Vorschau. Dein aktuelles Dokument bleibt dabei unverändert.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
