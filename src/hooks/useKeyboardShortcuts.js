import { useEffect } from 'react';

export function useKeyboardShortcuts({ assets, compareMode, setCompareMode, setPhase, setSelectedIdx }) {
  useEffect(() => {
    function handleKeydown(event) {
      const target = event.target;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT';
      if (isTyping) return;

      if (event.key === 'c') {
        setCompareMode(value => !value);
      } else if (event.key === 'Escape' && compareMode) {
        setCompareMode(false);
      } else if (['1', '2', '3'].includes(event.key)) {
        setPhase(Number(event.key));
      } else if (event.key === 'ArrowLeft') {
        setSelectedIdx(index => (index - 1 + assets.length) % assets.length);
      } else if (event.key === 'ArrowRight') {
        setSelectedIdx(index => (index + 1) % assets.length);
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [assets.length, compareMode, setCompareMode, setPhase, setSelectedIdx]);
}
