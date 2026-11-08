import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
export const searchKey = new PluginKey<DecorationSet>('writely-search');
export const SearchHighlights = Extension.create({
  name: 'searchHighlights',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: searchKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, previous) {
            const meta = tr.getMeta(searchKey);
            if (meta)
              return DecorationSet.create(
                tr.doc,
                meta.matches
                  .filter((m: any) => m.from >= 0 && m.to <= tr.doc.content.size)
                  .map((m: any, i: number) =>
                    Decoration.inline(m.from, m.to, {
                      class: i === meta.current ? 'search-hit search-current' : 'search-hit',
                    }),
                  ),
              );
            return tr.docChanged ? DecorationSet.empty : previous.map(tr.mapping, tr.doc);
          },
        },
        props: { decorations: (state) => searchKey.getState(state) },
      }),
    ];
  },
});
