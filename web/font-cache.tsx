import { createRoot } from 'react-dom/client';

import { MiddleTruncate } from '../src/react.js';
import '../src/styles.css';

const TEXT = 'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM';

const root = document.getElementById('root');

if (root === null) {
  throw new Error('Missing #root mount point');
}

createRoot(root).render(
  <MiddleTruncate className="font-cache-target" id="font-cache-target">
    {TEXT}
  </MiddleTruncate>,
);
