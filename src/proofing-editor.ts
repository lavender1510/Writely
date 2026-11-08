import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
export const proofingKey = new PluginKey<DecorationSet>('writely-proofing');
export const ProofingHighlights = Extension.create({
  name: 'proofingHighlights',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: proofingKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, previous) {
            const ranges = tr.getMeta(proofingKey);
            if (ranges)
              return DecorationSet.create(
                tr.doc,
                ranges
                  .filter((r: any) => r.to <= tr.doc.content.size)
                  .map((r: any) =>
                    Decoration.inline(r.from, r.to, {
                      class: 'spelling-error',
                      'data-word': r.word,
                    }),
                  ),
              );
            return previous.map(tr.mapping, tr.doc);
          },
        },
        props: { decorations: (state) => proofingKey.getState(state) },
      }),
    ];
  },
});
