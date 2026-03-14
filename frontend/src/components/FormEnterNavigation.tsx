'use client';

import { useEffect } from 'react';

export function FormEnterNavigation({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      const tagName = target.tagName.toLowerCase();
      if (tagName === 'textarea' || (tagName === 'button' && (target as HTMLButtonElement).type === 'submit')) {
        return;
      }

      const form = target.closest('form');
      if (!form) return;

      event.preventDefault();

      const focusableSelectors = [
        'input:not([type="hidden"]):not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'button:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ];

      const focusable = Array.from(
        form.querySelectorAll<HTMLElement>(focusableSelectors.join(',')),
      ).filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));

      const index = focusable.indexOf(target as HTMLElement);
      if (index === -1) return;

      const next = focusable[index + 1];
      if (next) {
        next.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  return <>{children}</>;
}
