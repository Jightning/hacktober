import { PythonCell } from './PythonCell';
import Markdown from 'react-markdown';
import type { PublicBlock } from '../../../shared/contracts';
export function PublicBlockView({
  block,
  onCodeChange,
}: {
  block: PublicBlock;
  onCodeChange?: (code: string) => void;
}) {
  switch (block.type) {
    case 'markdown':
      return (
        <div className="prose">
          <Markdown skipHtml>{block.text}</Markdown>
        </div>
      );
    case 'code':
      return <PythonCell code={block.code} title={block.title} onCodeChange={onCodeChange} />;
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
          {block.mode === 'ta' ? 'TA approval' : 'Automatic check'}{' '}
          {block.required ? 'Required' : 'Optional'}
        </p>
      );
  }
}
