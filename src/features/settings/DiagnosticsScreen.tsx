import { useEffect, useState } from 'react';
import { audioEngine } from '../../audio/engine';
import { ko } from '../../i18n/ko';

export function DiagnosticsScreen() {
  const [running, setRunning] = useState(false);
  const [levelDb, setLevelDb] = useState<number | null>(null);

  useEffect(() => audioEngine.onLevel((l) => setLevelDb(20 * Math.log10(Math.max(l.rms, 1e-9)))), []);
  useEffect(() => () => void audioEngine.dispose(), []);

  const toggle = async () => {
    if (running) {
      await audioEngine.dispose();
      setRunning(false);
    } else {
      await audioEngine.start();
      setRunning(true);
    }
  };

  return (
    <main id="main" className="p-4">
      <h1 className="text-2xl font-bold">{ko.diagnostics.title}</h1>
      <button type="button" className="mt-4 rounded bg-accent px-4 py-3 text-accent-fg" onClick={toggle}>
        {running ? ko.diagnostics.micStop : ko.diagnostics.micStart}
      </button>
      <p className="mt-4" data-testid="level-db">
        {ko.diagnostics.level}: {levelDb === null ? '—' : `${levelDb.toFixed(1)} dBFS`}
      </p>
    </main>
  );
}
