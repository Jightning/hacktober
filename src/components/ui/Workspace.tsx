import { useId, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export function Workspace({
  navigation,
  outline,
  children,
  assistant,
  assistantVisible = true,
}: {
  navigation: ReactNode;
  outline?: ReactNode;
  children: ReactNode;
  assistant?: ReactNode;
  assistantVisible?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(() => window.matchMedia('(min-width: 1201px)').matches);
  const [assistantOpen, setAssistantOpen] = useState(
    () => window.matchMedia('(min-width: 1501px)').matches,
  );
  const id = useId();
  const showAssistant = Boolean(assistant && assistantVisible && assistantOpen);
  return (
    <div
      className={`notebook-workspace ${menuOpen ? 'with-navigation' : ''} ${outline ? 'with-outline' : ''} ${showAssistant ? 'with-assistant' : ''}`}
    >
      <div className="workspace-rail workspace-rail-left">
        <button
          type="button"
          className="icon-button"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          title={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          aria-controls={`${id}-nav`}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name={menuOpen ? 'menu_open' : 'menu'} />
        </button>
      </div>
      <aside
        id={`${id}-nav`}
        className="workspace-sidebar"
        aria-label="Workspace navigation"
        hidden={!menuOpen}
      >
        {navigation}
      </aside>
      {outline && (
        <aside className="workspace-outline-column" aria-label="Document outline">
          {outline}
        </aside>
      )}
      <div className="workspace-document">{children}</div>
      {assistant && (
        <aside
          id={`${id}-ai`}
          className="workspace-assistant"
          aria-label="AI assistant"
          hidden={!showAssistant}
        >
          {assistant}
        </aside>
      )}
      {assistant && assistantVisible && (
        <div className="workspace-rail workspace-rail-right">
          <button
            type="button"
            className="icon-button"
            aria-label={assistantOpen ? 'Close AI assistant' : 'Open AI assistant'}
            title={assistantOpen ? 'Close AI assistant' : 'Open AI assistant'}
            aria-expanded={assistantOpen}
            aria-controls={`${id}-ai`}
            onClick={() => setAssistantOpen(!assistantOpen)}
          >
            <Icon name={assistantOpen ? 'close' : 'auto_awesome'} />
          </button>
        </div>
      )}
    </div>
  );
}
