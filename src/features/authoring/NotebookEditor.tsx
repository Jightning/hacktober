import type { EditorBlock, EditorDraft } from './types';
import { PublicBlockView } from '../../components/lab-blocks/PublicBlockView';
import { BlockEditor } from './BlockEditor';

export function NotebookEditor({
  draft,
  edit,
  activeCell,
  setActiveCell,
  add,
}: {
  draft: EditorDraft;
  edit: (draft: EditorDraft) => void;
  activeCell: string;
  setActiveCell: (id: string) => void;
  add: (type: EditorBlock['type']) => void;
}) {
  return (
    <div className="stack">
      <label>
        Lab title
        <input
          required
          value={draft.title}
          onChange={(event) => edit({ ...draft, title: event.target.value })}
        />
      </label>
      {draft.blocks.map((block, index) => (
        <section className="notebook-cell" id={`cell-${block.id}`} key={block.id}>
          <button
            className="cell-heading"
            type="button"
            aria-expanded={activeCell === block.id}
            aria-controls={`editor-${block.id}`}
            onClick={() => setActiveCell(activeCell === block.id ? '' : block.id)}
          >
            <span className="muted">
              {index + 1} · {block.type}
            </span>{' '}
            <strong>{block.title || 'Untitled cell'}</strong>
            <span>{activeCell === block.id ? 'Collapse' : 'Edit'}</span>
          </button>
          {activeCell !== block.id && (
            <div className="cell-summary">
              {block.type === 'markdown' ? (
                <PublicBlockView block={block} />
              ) : block.type === 'code' ? (
                <PublicBlockView block={block} />
              ) : block.type === 'image' ? (
                block.alt || 'Image'
              ) : block.type === 'answer' ? (
                `${block.input === 'number' ? 'Number' : 'Short text'} response${block.units ? ` · ${block.units}` : ''}`
              ) : (
                `${block.mode === 'ta' ? 'TA approval' : 'Automatic check'} · ${block.required ? 'Required' : 'Optional'}`
              )}
            </div>
          )}
          <div id={`editor-${block.id}`} hidden={activeCell !== block.id}>
            {activeCell === block.id && (
              <BlockEditor
                block={block}
                answers={draft.blocks.filter((item) => item.type === 'answer')}
                first={index === 0}
                last={index === draft.blocks.length - 1}
                onChange={(next) =>
                  edit({
                    ...draft,
                    blocks: draft.blocks.map((item) => (item.id === block.id ? next : item)),
                  })
                }
                onMove={(direction) => {
                  const blocks = [...draft.blocks];
                  [blocks[index], blocks[index + direction]] = [
                    blocks[index + direction],
                    blocks[index],
                  ];
                  edit({ ...draft, blocks });
                }}
                onDelete={() => {
                  edit({
                    ...draft,
                    blocks: draft.blocks
                      .filter((item) => item.id !== block.id)
                      .map((item) =>
                        item.type === 'checkpoint'
                          ? {
                              ...item,
                              answerIds: item.answerIds.filter((answerId) => answerId !== block.id),
                            }
                          : item,
                      ),
                  });
                  setActiveCell('');
                }}
              />
            )}
          </div>
        </section>
      ))}
      <div className="panel row">
        <span>Add cell</span>
        {(['markdown', 'code', 'image', 'answer', 'checkpoint'] as const).map((type) => (
          <button type="button" key={type} onClick={() => add(type)}>
            {type}
          </button>
        ))}
      </div>
    </div>
  );
}
