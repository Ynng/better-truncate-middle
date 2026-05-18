import { createRoot, hydrateRoot } from 'react-dom/client';

import { Demo } from './demo.js';
import { bootstrapWebPage } from './main.js';
import '../src/styles.css';

bootstrapWebPage();
hydrateDemo();

function hydrateDemo(): void {
  const root = document.getElementById('demo-root');
  if (root === null) {
    throw new Error('Missing #demo-root mount point');
  }

  if (root.hasChildNodes()) {
    hydrateRoot(root, <Demo />);
  } else {
    createRoot(root).render(<Demo />);
  }
}
