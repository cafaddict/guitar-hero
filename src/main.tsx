import './app/zodConfig';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { requestPersistentStorage } from './app/persist';
import { installTestHooks } from './app/testHooks';
import { registerAllExercises } from './exercises/catalog';
import './app/styles.css';

registerAllExercises();
void requestPersistentStorage();
installTestHooks();

const container = document.getElementById('root');
if (!container) throw new Error('missing #root');
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
