import Markdown from 'react-markdown';
import type { PublicBlock } from '../../../shared/contracts';
export function PublicBlockView({ block }: { block: PublicBlock }) {
  switch (block.type) {
    case 'markdown':
      return (
        <div className="prose">
          <Markdown skipHtml>{block.text}</Markdown>
        </div>
      );
    case 'code':
      return (
        <figure>
          <figcaption>{block.language || 'Code'} · display only</figcaption>
          <pre>
            <code>{block.code}</code>
          </pre>
        </figure>
      );
    case 'image':
      return <img className="lab-image" src={block.url} alt={block.alt} />;
    case 'answer':
      return (
        <p>
          Response: {block.input === 'number' ? 'number' : 'short text'}
          {block.units && ` (${block.units})`}
        </p>
      );
    case 'checkpoint':
      return (
        <p>
          {block.mode === 'ta' ? 'TA approval' : 'Automatic check'} ·{' '}
          {block.required ? 'Required' : 'Optional'}
        </p>
      );
  }
}
