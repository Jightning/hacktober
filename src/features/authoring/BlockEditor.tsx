import type { EditorBlock } from './types';
export function BlockEditor({
  block,
  answers,
  onChange,
  onMove,
  onDelete,
  first,
  last,
}: {
  block: EditorBlock;
  answers: EditorBlock[];
  onChange: (block: EditorBlock) => void;
  onMove: (direction: number) => void;
  onDelete: () => void;
  first: boolean;
  last: boolean;
}) {
  const patch = (fields: object) => onChange({ ...block, ...fields } as EditorBlock);
  return (
    <section className="panel stack">
      <div className="row between">
        <strong>{block.type}</strong>
        <div className="row">
          <button
            type="button"
            aria-label={`Move ${block.title} up`}
            disabled={first}
            onClick={() => onMove(-1)}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={`Move ${block.title} down`}
            disabled={last}
            onClick={() => onMove(1)}
          >
            ↓
          </button>
          <button type="button" onClick={onDelete}>
            Delete block
          </button>
        </div>
      </div>
      <label>
        Block title
        <input
          value={block.title}
          onChange={(e) => patch({ title: e.target.value })}
          required
          maxLength={200}
        />
      </label>
      {block.type === 'markdown' && (
        <label>
          Markdown content
          <textarea rows={5} value={block.text} onChange={(e) => patch({ text: e.target.value })} />
        </label>
      )}
      {block.type === 'code' && (
        <>
          <label>
            Language label
            <input value={block.language} onChange={(e) => patch({ language: e.target.value })} />
          </label>
          <label>
            Code (display only)
            <textarea
              rows={5}
              value={block.code}
              onChange={(e) => patch({ code: e.target.value })}
            />
          </label>
        </>
      )}
      {block.type === 'image' && (
        <>
          <label>
            Image URL
            <input
              type="url"
              required
              value={block.url}
              onChange={(e) => patch({ url: e.target.value })}
            />
          </label>
          <label>
            Alternative text
            <input required value={block.alt} onChange={(e) => patch({ alt: e.target.value })} />
          </label>
        </>
      )}
      {block.type === 'answer' && (
        <div className="two-columns">
          <label>
            Input type
            <select value={block.input} onChange={(e) => patch({ input: e.target.value })}>
              <option value="text">Short text</option>
              <option value="number">Number</option>
            </select>
          </label>
          <label>
            Units label (optional)
            <input value={block.units} onChange={(e) => patch({ units: e.target.value })} />
          </label>
        </div>
      )}
      {block.type === 'checkpoint' && (
        <>
          <label>
            Verification
            <select
              value={block.mode}
              onChange={(e) =>
                patch({
                  mode: e.target.value,
                  rule:
                    e.target.value === 'automatic' ? { kind: 'exact', expected: '' } : undefined,
                })
              }
            >
              <option value="ta">TA approval</option>
              <option value="automatic">Automatic validation</option>
            </select>
          </label>
          <fieldset>
            <legend>
              Relevant answer blocks{block.mode === 'automatic' ? ' (choose one)' : ''}
            </legend>
            {answers.length === 0 && <p>Add an answer block first.</p>}
            {answers.map((a) => (
              <label className="check" key={a.id}>
                <input
                  type="checkbox"
                  checked={block.answerIds.includes(a.id)}
                  onChange={(e) =>
                    patch({
                      answerIds: e.target.checked
                        ? block.mode === 'automatic'
                          ? [a.id]
                          : [...block.answerIds, a.id]
                        : block.answerIds.filter((id) => id !== a.id),
                    })
                  }
                />
                {a.title}
              </label>
            ))}
          </fieldset>
          <label className="check">
            <input
              type="checkbox"
              checked={block.required}
              onChange={(e) => patch({ required: e.target.checked })}
            />{' '}
            Required for lab completion
          </label>
          {block.mode === 'ta' ? (
            <label>
              Private rubric / expected outcome
              <textarea
                required
                value={block.rubric || ''}
                onChange={(e) => patch({ rubric: e.target.value })}
              />
            </label>
          ) : (
            <>
              <label>
                Private rule
                <select
                  value={block.rule?.kind || 'exact'}
                  onChange={(e) =>
                    patch({
                      rule:
                        e.target.value === 'exact'
                          ? { kind: 'exact', expected: '' }
                          : { kind: 'numeric', expected: 0, tolerance: 0, units: '' },
                    })
                  }
                >
                  <option value="exact">Normalized exact text</option>
                  <option value="numeric">Numeric with tolerance</option>
                </select>
              </label>
              <label>
                Expected answer (private)
                <input
                  required
                  type={block.rule?.kind === 'numeric' ? 'number' : 'text'}
                  step="any"
                  value={block.rule?.expected ?? ''}
                  onChange={(e) =>
                    patch({
                      rule: {
                        ...(block.rule || { kind: 'exact' }),
                        expected:
                          block.rule?.kind === 'numeric' ? Number(e.target.value) : e.target.value,
                      },
                    })
                  }
                />
              </label>
              {block.rule?.kind === 'numeric' && (
                <div className="two-columns">
                  <label>
                    Absolute tolerance
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={block.rule.tolerance}
                      onChange={(e) =>
                        patch({ rule: { ...block.rule, tolerance: Number(e.target.value) } })
                      }
                    />
                  </label>
                  <label>
                    Required units
                    <input
                      required
                      value={block.rule.units}
                      onChange={(e) => patch({ rule: { ...block.rule, units: e.target.value } })}
                    />
                  </label>
                </div>
              )}
            </>
          )}
        </>
      )}
      <details>
        <summary>Instructor notes (staff only)</summary>
        <label>
          Notes
          <textarea
            value={block.instructorNotes || ''}
            onChange={(e) => patch({ instructorNotes: e.target.value })}
          />
        </label>
      </details>
    </section>
  );
}
