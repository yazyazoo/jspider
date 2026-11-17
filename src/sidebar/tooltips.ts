type TooltipRoot = Document | HTMLElement;

function triggerFrom(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data-tooltip]') : null;
}

function tooltipFor(trigger: HTMLElement): HTMLElement | null {
  const id = trigger.getAttribute('aria-describedby');
  return id ? trigger.ownerDocument.getElementById(id) : null;
}

function positionTooltip(trigger: HTMLElement, tooltip: HTMLElement): void {
  const margin = 12;
  const gap = 7;
  const bounds = trigger.getBoundingClientRect();
  const tooltipBounds = tooltip.getBoundingClientRect();
  const viewport = trigger.ownerDocument.documentElement;
  const window = trigger.ownerDocument.defaultView;
  const viewportWidth = viewport.clientWidth || window?.innerWidth || 0;
  const viewportHeight = viewport.clientHeight || window?.innerHeight || 0;
  const maxLeft = Math.max(margin, viewportWidth - tooltipBounds.width - margin);
  const left = Math.min(Math.max(bounds.left, margin), maxLeft);
  const below = bounds.bottom + gap;
  const above = bounds.top - gap - tooltipBounds.height;
  const top = below + tooltipBounds.height <= viewportHeight - margin
    ? below
    : Math.max(margin, above);
  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
}

export function initializeTooltips(root: TooltipRoot): () => void {
  let active: HTMLElement | null = null;
  let pinned = false;

  const hide = (): void => {
    if (!active) return;
    const tooltip = tooltipFor(active);
    if (tooltip) tooltip.hidden = true;
    active.setAttribute('aria-expanded', 'false');
    active = null;
    pinned = false;
  };
  const show = (trigger: HTMLElement, pin = false): void => {
    const tooltip = tooltipFor(trigger);
    if (!tooltip || tooltip.getAttribute('role') !== 'tooltip') return;
    if (active !== trigger) {
      hide();
      pinned = pin;
    } else if (pin) {
      pinned = true;
    }
    active = trigger;
    tooltip.hidden = false;
    positionTooltip(trigger, tooltip);
    trigger.setAttribute('aria-expanded', 'true');
  };
  const containsActive = (target: EventTarget | null): boolean => {
    if (!(target instanceof Node) || !active) return false;
    return active.contains(target) || Boolean(tooltipFor(active)?.contains(target));
  };
  const pointerOver = (event: Event): void => {
    const trigger = triggerFrom(event.target);
    if (trigger) show(trigger);
  };
  const pointerOut = (event: Event): void => {
    const pointer = event as PointerEvent;
    if (!active || !(event.target instanceof Node)) return;
    const leavingActiveArea = active.contains(event.target)
      || Boolean(tooltipFor(active)?.contains(event.target));
    if (!pinned && leavingActiveArea && !containsActive(pointer.relatedTarget)) hide();
  };
  const focusIn = (event: Event): void => {
    const trigger = triggerFrom(event.target);
    if (trigger) show(trigger);
  };
  const focusOut = (event: Event): void => {
    const focus = event as FocusEvent;
    if (!pinned && triggerFrom(event.target) === active && !containsActive(focus.relatedTarget)) hide();
  };
  const click = (event: Event): void => {
    const trigger = triggerFrom(event.target);
    if (!trigger) {
      if (!containsActive(event.target)) hide();
      return;
    }
    if (active === trigger && pinned) hide();
    else show(trigger, true);
  };
  const keydown = (event: Event): void => {
    if ((event as KeyboardEvent).key === 'Escape') hide();
  };

  root.addEventListener('pointerover', pointerOver);
  root.addEventListener('pointerout', pointerOut);
  root.addEventListener('focusin', focusIn);
  root.addEventListener('focusout', focusOut);
  root.addEventListener('click', click);
  root.addEventListener('keydown', keydown);
  return () => {
    hide();
    root.removeEventListener('pointerover', pointerOver);
    root.removeEventListener('pointerout', pointerOut);
    root.removeEventListener('focusin', focusIn);
    root.removeEventListener('focusout', focusOut);
    root.removeEventListener('click', click);
    root.removeEventListener('keydown', keydown);
  };
}

