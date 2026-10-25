import { useId, useState, type ReactNode } from 'react';

export function Workspace({
  navigation,
  children,
  assistant,
  assistantVisible = true,
}: {
  navigation: ReactNode;
  children: ReactNode;
  assistant?: ReactNode;
  assistantVisible?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const id = useId();
  return (
    <div
      className={`notebook-workspace ${assistant && assistantVisible && assistantOpen ? 'with-assistant' : ''}`}
    >
      <div className="workspace-controls">
        <button
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-controls={`${id}-nav`}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          Menu
        </button>
        {assistant && assistantVisible && (
          <button
            className="assistant-toggle"
            aria-expanded={assistantOpen}
            aria-controls={`${id}-ai`}
            onClick={() => setAssistantOpen(!assistantOpen)}
          >
            {assistantOpen ? 'Hide AI' : 'Show AI'}
          </button>
        )}
      </div>
      <aside id={`${id}-nav`} className={`workspace-sidebar ${menuOpen ? 'is-open' : ''}`}>
        {navigation}
      </aside>
      <div className="workspace-document">{children}</div>
      {assistant && (
        <aside
          id={`${id}-ai`}
          className="workspace-assistant"
          hidden={!assistantVisible || !assistantOpen}
        >
          {assistant}
        </aside>
      )}
    </div>
  );
}
