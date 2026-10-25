import { Icon } from '../../components/ui/Icon';
import type { EditorDraft } from './types';
import { PublicBlockView } from '../../components/lab-blocks/PublicBlockView';
import { BlockEditor } from './BlockEditor';

export function NotebookEditor({
  draft,
  edit,
  activeCell,
  setActiveCell,
}: {
  draft: EditorDraft;
  edit: (draft: EditorDraft) => void;
  activeCell: string;
  setActiveCell: (id: string) => void;
}) {
  return (
    <div className="stack">
      <label>
        Lab title
        <input
          required
          data-field="title"
          value={draft.title}
          onChange={(event) => edit({ ...draft, title: event.target.value })}
        />
      </label>
      {draft.blocks.map((block, index) => (
        <section className="notebook-cell" id={`cell-${block.id}`} key={block.id}>
          <button
            className="cell-heading"
            type="button"
            aria-label={`${activeCell === block.id ? 'Close editor for' : 'Edit'} ${block.title || 'untitled cell'}`}
            aria-expanded={activeCell === block.id}
            aria-controls={`editor-${block.id}`}
            onClick={() => setActiveCell(activeCell === block.id ? '' : block.id)}
          >
            <strong>{block.title.replace(/^\d+\.\s*/, '') || 'Untitled cell'}</strong>
            <Icon name={activeCell === block.id ? 'close' : 'edit'} />
          </button>
          {activeCell !== block.id && (
            <div className="cell-summary">
              {block.type === 'answer' ? (
                <input
                  aria-label={block.title}
                  placeholder={
                    block.units ? `Student response (${block.units})` : 'Student response'
                  }
                  disabled
                />
              ) : block.type === 'checkpoint' ? (
                <p className="muted">Awaiting verification</p>
              ) : (
                <PublicBlockView
                  block={block}
                  onCodeChange={
                    block.type === 'code'
                      ? (code) =>
                          edit({
                            ...draft,
                            blocks: draft.blocks.map((item) =>
                              item.id === block.id ? { ...block, code } : item,
                            ),
                          })
                      : undefined
                  }
                />
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
    </div>
  );
}
