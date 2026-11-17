type PopoverRoot = Document | HTMLElement;

export function initializeDismissiblePopover(
  button: HTMLButtonElement,
  panel: HTMLElement,
  root: PopoverRoot,
): () => void {
  const setOpen = (open: boolean): void => {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };
  const click = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (button.contains(target)) {
      setOpen(panel.hidden);
    } else if (!panel.contains(target)) {
      setOpen(false);
    }
  };
  const keydown = (event: Event): void => {
    if ((event as KeyboardEvent).key === 'Escape') setOpen(false);
  };
  root.addEventListener('click', click);
  root.addEventListener('keydown', keydown);
  return () => {
    setOpen(false);
    root.removeEventListener('click', click);
    root.removeEventListener('keydown', keydown);
  };
}
