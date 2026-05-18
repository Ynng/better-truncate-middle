import { renderToString } from 'react-dom/server';

import { Demo } from './demo.js';

export function render(): string {
  return renderToString(<Demo />);
}
