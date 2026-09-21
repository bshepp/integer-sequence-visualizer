import './style.css';
import { mountApp } from './ui/app';

mountApp(document.querySelector<HTMLDivElement>('#app')!);

// Dev-only: regenerate public/og-card.png from the current hero entry.
// Guarded by import.meta.env.DEV so it is tree-shaken out of the production
// bundle entirely. See src/ui/ogCard.ts.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('ogcard')) {
  void import('./ui/ogCard').then((m) => m.exportOgCard());
}

// Dev-only: the 3D index-lift tool. Dynamic import inside the DEV guard, so
// three.js is tree-shaken out of the production bundle entirely.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('3d')) {
  void import('./viz3d/dev/route').then((m) => m.mount3dRoute(document.querySelector<HTMLDivElement>('#app')!));
}
