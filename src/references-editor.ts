import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
const key = new PluginKey('writely-references');
function headings(doc: any) {
  const out: { id: string; text: string; level: number; pos: number }[] = [];
  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'heading')
      out.push({ id: node.attrs.anchorId, text: node.textContent, level: node.attrs.level, pos });
  });
  return out;
}
function drawTOCs(view: any) {
  const items = headings(view.state.doc);
  view.dom.querySelectorAll('[data-toc-view]').forEach((el: HTMLElement) => {
    const list = el.querySelector('.toc-entries')!;
    list.replaceChildren();
    for (const h of items.filter((h) => h.level <= Number(el.dataset.maxLevel || 6))) {
      const a = document.createElement('button');
      a.type = 'button';
      a.dataset.styleId = 'toc';
      a.textContent = h.text || 'Ohne Überschrift';
      a.style.paddingLeft = (h.level - 1) * 14 + 'px';
      a.setAttribute('data-toc-target', h.id);
      list.append(a);
    }
    if (!list.childNodes.length) list.textContent = 'Überschriften erscheinen hier automatisch.';
  });
}
function decorations(doc: any) {
  const marks: Decoration[] = [],
    count = { footnote: 0, endnote: 0 };
  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'note') {
      const kind = node.attrs.kind as keyof typeof count,
        number = ++count[kind];
      marks.push(
        Decoration.node(pos, pos + node.nodeSize, {
          'data-number': `${kind === 'endnote' ? 'E' : ''}${number}`,
          'aria-label': `${kind === 'endnote' ? 'Endnote' : 'Fußnote'} ${number}: ${node.attrs.text}`,
        }),
      );
    }
  });
  return DecorationSet.create(doc, marks);
}
export const HeadingAnchors = Extension.create({
  name: 'headingAnchors',
  addGlobalAttributes() {
    return [
      {
        types: ['heading'],
        attributes: {
          anchorId: {
            default: null,
            parseHTML: (el) => el.id || null,
            renderHTML: (a) => (a.anchorId ? { id: a.anchorId } : {}),
          },
        },
      },
    ];
  },
  onCreate() {
    this.editor.view.dispatch(this.editor.state.tr.setMeta(key, 'seed'));
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        state: {
          init: (_, state) => decorations(state.doc),
          apply: (tr, previous) => (tr.docChanged ? decorations(tr.doc) : previous),
        },
        appendTransaction(transactions, _old, state) {
          if (!transactions.some((tr) => tr.docChanged || tr.getMeta(key) === 'seed')) return null;
          const used = new Set(),
            tr = state.tr;
          state.doc.descendants((node, pos) => {
            const prop =
              node.type.name === 'heading'
                ? 'anchorId'
                : node.type.name === 'note' || node.type.name === 'toc'
                  ? 'id'
                  : null;
            if (!prop) return;
            let id = node.attrs[prop];
            if (typeof id !== 'string' || !id || used.has(id)) {
              id = 'w-' + crypto.randomUUID();
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, [prop]: id });
            }
            used.add(id);
          });
          return tr.docChanged ? tr.setMeta('addToHistory', false) : null;
        },
        view(view) {
          drawTOCs(view);
          return {
            update(next, previous) {
              if (!next.state.doc.eq(previous.doc)) drawTOCs(next);
            },
          };
        },
        props: {
          decorations: (state) => key.getState(state) as DecorationSet,
          handleClick(view, _pos, event) {
            const button = (event.target as HTMLElement).closest(
              '[data-toc-target]',
            ) as HTMLElement | null;
            if (!button) return false;
            const h = headings(view.state.doc).find((h) => h.id === button.dataset.tocTarget);
            if (h) {
              view.dispatch(
                view.state.tr
                  .setSelection(TextSelection.near(view.state.doc.resolve(h.pos + 1)))
                  .scrollIntoView(),
              );
              view.focus();
            }
            return true;
          },
        },
      }),
    ];
  },
});
export const Note = Node.create({
  name: 'note',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { id: { default: null }, kind: { default: 'footnote' }, text: { default: '' } };
  },
  parseHTML() {
    return [
      {
        tag: 'sup[data-note-id]',
        getAttrs: (el) => ({
          id: (el as HTMLElement).dataset.noteId,
          kind: (el as HTMLElement).dataset.noteKind || 'footnote',
          text: (el as HTMLElement).dataset.noteText || '',
        }),
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'sup',
      mergeAttributes(HTMLAttributes, {
        'data-note-id': node.attrs.id,
        'data-note-kind': node.attrs.kind,
        'data-note-text': node.attrs.text,
        class: 'note-reference',
        title: node.attrs.text,
      }),
      '†',
    ];
  },
});
export const DynamicTOC = Node.create({
  name: 'toc',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      id: { default: null },
      title: { default: 'Inhaltsverzeichnis' },
      maxLevel: { default: 6 },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-writely-toc]' }];
  },
  renderHTML({ node }) {
    return ['div', { 'data-writely-toc': node.attrs.id }, node.attrs.title];
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('nav');
      dom.dataset.tocView = node.attrs.id;
      dom.dataset.maxLevel = String(node.attrs.maxLevel);
      dom.className = 'dynamic-toc';
      dom.contentEditable = 'false';
      dom.setAttribute('aria-label', 'Dynamisches Inhaltsverzeichnis');
      const title = document.createElement('h2');
      title.textContent = node.attrs.title;
      const entries = document.createElement('div');
      entries.className = 'toc-entries';
      dom.append(title, entries);
      return { dom };
    };
  },
});
