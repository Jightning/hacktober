import { useCallback, useEffect, useRef } from 'react';
import { send } from '../../lib/api';

/** Report navigation context independently of saved answers and checkpoint verification. */
export function useCurrentStep({
  publicationId,
  labId,
  enabled,
  onError,
}: {
  publicationId: string;
  labId?: string;
  enabled: boolean;
  onError: (message: string) => void;
}) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const focusedBlock = useRef<string | null>(null);
  const pendingVisit = useRef('');
  const lastVisited = useRef('');
  const visitBusy = useRef(false);
  const lastVisitAt = useRef(0);
  const visitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  const inspectViewport = useRef<() => void>(() => {});
  const visit = useCallback(
    function queueVisit(blockId: string) {
      if (!enabledRef.current || !mounted.current) return;
      if (pendingVisit.current === blockId && visitTimer.current) return;
      pendingVisit.current = blockId;
      if (visitTimer.current) clearTimeout(visitTimer.current);
      visitTimer.current = undefined;
      if (visitBusy.current || lastVisited.current === blockId) return;
      visitTimer.current = setTimeout(
        async () => {
          visitTimer.current = undefined;
          const nextBlock = pendingVisit.current;
          if (
            !nextBlock ||
            lastVisited.current === nextBlock ||
            !mounted.current ||
            !enabledRef.current
          )
            return;
          visitBusy.current = true;
          lastVisitAt.current = Date.now();
          try {
            await send(`/publications/${publicationId}/visit`, { blockId: nextBlock });
            lastVisited.current = nextBlock;
          } catch (e) {
            if (mounted.current) onError((e as Error).message);
            if (pendingVisit.current === nextBlock) pendingVisit.current = '';
          } finally {
            visitBusy.current = false;
            if (
              mounted.current &&
              enabledRef.current &&
              pendingVisit.current &&
              pendingVisit.current !== lastVisited.current
            )
              queueVisit(pendingVisit.current);
          }
        },
        Math.max(400, 750 - (Date.now() - lastVisitAt.current)),
      );
    },
    [publicationId, onError],
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (visitTimer.current) clearTimeout(visitTimer.current);
      visitTimer.current = undefined;
    };
  }, []);
  useEffect(() => {
    if (!enabled) {
      if (visitTimer.current) clearTimeout(visitTimer.current);
      visitTimer.current = undefined;
      pendingVisit.current = '';
      focusedBlock.current = null;
      return;
    }
    if (!labId) return;
    const cells = Array.from(document.querySelectorAll<HTMLElement>('.student-cell'));
    const inspect = () => {
      if (!enabledRef.current || focusedBlock.current) return;
      const visible = cells
        .map((cell) => ({ cell, bounds: cell.getBoundingClientRect() }))
        .filter(
          ({ bounds }) => bounds.height > 0 && bounds.bottom > 0 && bounds.top < window.innerHeight,
        )
        .sort(
          (a, b) =>
            Math.abs(a.bounds.top - window.innerHeight * 0.25) -
            Math.abs(b.bounds.top - window.innerHeight * 0.25),
        );
      if (visible[0]) visit(visible[0].cell.id.slice('block-'.length));
    };
    inspectViewport.current = inspect;
    let frame: number | undefined;
    const scheduleInspection = () => {
      if (frame !== undefined || !enabledRef.current) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        inspect();
      });
    };
    scheduleInspection();
    window.addEventListener('scroll', scheduleInspection, { passive: true });
    window.addEventListener('resize', scheduleInspection);
    return () => {
      window.removeEventListener('scroll', scheduleInspection);
      window.removeEventListener('resize', scheduleInspection);
      if (frame !== undefined) cancelAnimationFrame(frame);
      inspectViewport.current = () => {};
    };
  }, [labId, enabled, visit]);
  return {
    visit,
    focusBlock(blockId: string) {
      if (!enabledRef.current) return;
      focusedBlock.current = blockId;
      visit(blockId);
    },
    blurBlock() {
      focusedBlock.current = null;
      inspectViewport.current();
    },
  };
}
