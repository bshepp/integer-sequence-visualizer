import './style.css';
import { mountApp } from './ui/app';

mountApp(document.querySelector<HTMLDivElement>('#app')!);

// Dev-only: regenerate public/og-card.png from the current hero entry.
// Guarded by import.meta.env.DEV so it is tree-shaken out of the production
// bundle entirely. See src/ui/ogCard.ts.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('ogcard')) {
  void import('./ui/ogCard').then((m) => m.exportOgCard());
}
