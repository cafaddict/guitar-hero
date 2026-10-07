import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { installTestHooks } from './app/testHooks';
import { registerAllExercises } from './exercises/catalog';
import './app/styles.css';

registerAllExercises();
installTestHooks();

const container = document.getElementById('root');
if (!container) throw new Error('missing #root');
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
