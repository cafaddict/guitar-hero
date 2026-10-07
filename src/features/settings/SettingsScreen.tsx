import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { defaultKeysFor } from '../../app/keys';
import { persistentStorageGranted, requestPersistentStorage } from '../../app/persist';
import { repo } from '../../app/services';
import { useSettingsStore } from '../../app/settingsStore';
import { LAST_BACKUP_KEY } from '../../app/storedState';
import {
  applyImport,
  exportAll,
  exportFileName,
  type ImportPreview,
  parseImport,
} from '../../data/exportImport';
import { KEY_ACTIONS, type KeyAction, type Settings } from '../../data/settings';
import { dayKey } from '../../domain/records';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';

const linkClass = 'inline-flex min-h-12 items-center rounded-lg bg-surface-2 px-4 font-semibold';

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Toggle({
  label,
  checked,
  onChange,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
}) {
  return (
    <label className="flex min-h-12 items-center gap-3">
      <input
        type="checkbox"
        className="h-6 w-6"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        data-testid={testId}
      />
      <span>{label}</span>
    </label>
  );
}

function BackupSection() {
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [persisted, setPersisted] = useState(persistentStorageGranted());
  const file = useRef<HTMLInputElement>(null);
  const load = useSettingsStore((s) => s.load);

  useEffect(() => {
    void repo.getMeta<number>(LAST_BACKUP_KEY).then((v) => setLastBackup(v ?? null));
    if (persisted === null) void requestPersistentStorage().then(setPersisted);
  }, [persisted]);

  const exportNow = async () => {
    const now = Date.now();
    await repo.setMeta(LAST_BACKUP_KEY, now);
    const envelope = await exportAll(repo.db, now);
    const name = exportFileName(now);
    download(name, JSON.stringify(envelope));
    setLastBackup(now);
    setMessage(ko.settingsScreen.exported(name));
  };

  const pick = async (f: File) => {
    try {
      setPreview(parseImport(await f.text()));
      setMessage(null);
    } catch {
      setPreview(null);
      setMessage(ko.settingsScreen.importError);
    }
  };

  const apply = async (mode: 'merge' | 'replace') => {
    if (!preview) return;
    await applyImport(repo, preview.envelope, mode);
    await load();
    setPreview(null);
    setConfirmReplace(false);
    setMessage(ko.settingsScreen.importDone);
  };

  return (
    <section className="rounded-lg bg-surface p-4" id="backup" data-testid="backup-section">
      <h2 className="text-lg font-bold">{ko.settingsScreen.backup}</h2>
      <p className="text-sm text-muted">
        {ko.settingsScreen.lastBackup(lastBackup === null ? null : dayKey(lastBackup))}
      </p>
      {persisted !== null && <p className="text-sm text-muted">{ko.settingsScreen.persist(persisted)}</p>}
      <p className="text-sm text-muted">{ko.settingsScreen.homeScreenTip}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => void exportNow()} data-testid="export-data">
          {ko.settingsScreen.exportData}
        </Button>
        <Button variant="secondary" onClick={() => file.current?.click()}>
          {ko.settingsScreen.importData}
        </Button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label={ko.settingsScreen.importData}
          data-testid="import-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pick(f);
            e.target.value = '';
          }}
        />
      </div>
      {preview && (
        <div className="mt-3 rounded-lg bg-surface-2 p-3" data-testid="import-preview">
          <p>
            {ko.settingsScreen.importPreview(
              Object.entries(preview.counts)
                .filter(([, n]) => n > 0)
                .map(([t, n]) => `${t} ${n}`)
                .join(', '),
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button onClick={() => void apply('merge')}>{ko.settingsScreen.importMerge}</Button>
            {!confirmReplace ? (
              <Button variant="secondary" onClick={() => setConfirmReplace(true)}>
                {ko.settingsScreen.importReplace}
              </Button>
            ) : (
              <div
                role="alertdialog"
                aria-label={ko.settingsScreen.importReplaceConfirm}
                className="flex flex-wrap items-center gap-2"
              >
                <span>{ko.settingsScreen.importReplaceConfirm}</span>
                <Button onClick={() => void apply('replace')} data-testid="import-replace-confirm">
                  {ko.settingsScreen.yes}
                </Button>
                <Button variant="secondary" onClick={() => setConfirmReplace(false)}>
                  {ko.settingsScreen.cancel}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      {message && (
        <p role="status" className="mt-2" data-testid="backup-message">
          {message}
        </p>
      )}
    </section>
  );
}

/** Key/pedal mapping (SPEC §12.3): defaults plus learned bindings (any key → an action). */
function KeysSection() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [learning, setLearning] = useState<KeyAction | null>(null);

  useEffect(() => {
    if (!learning) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key !== 'Escape' && settings)
        void update({ customKeys: { ...settings.customKeys, [e.code]: learning } });
      setLearning(null);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [learning, settings, update]);

  if (!settings) return null;
  const keyName = (key: string) => ko.keys.keyNames[key] ?? key;
  const custom = Object.entries(settings.customKeys);
  return (
    <section className="rounded-lg bg-surface p-4" data-testid="keys-section">
      <h2 className="text-lg font-bold">{ko.settingsScreen.keys}</h2>
      <p className="text-sm text-muted">{ko.keys.pedalTip}</p>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th scope="col" />
            <th scope="col">{ko.keys.defaults}</th>
            <th scope="col" />
          </tr>
        </thead>
        <tbody>
          {KEY_ACTIONS.map((action) => (
            <tr key={action}>
              <th scope="row" className="py-1 text-left font-normal">
                {ko.keys.actions[action]}
              </th>
              <td>{defaultKeysFor(action).map(keyName).join(' · ')}</td>
              <td className="text-right">
                <Button variant="ghost" onClick={() => setLearning(action)} data-testid={`learn-${action}`}>
                  {ko.keys.learn}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {learning && (
        <p role="status" className="mt-2 text-info" data-testid="learn-prompt">
          {ko.keys.learnPrompt(ko.keys.actions[learning] ?? learning)}
        </p>
      )}
      {custom.length > 0 && (
        <div className="mt-3">
          <h3 className="font-semibold">{ko.keys.custom}</h3>
          <ul data-testid="custom-keys">
            {custom.map(([code, action]) => (
              <li key={code} className="flex items-center justify-between">
                <span>{ko.keys.learned(code, ko.keys.actions[action] ?? action)}</span>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const { [code]: _removed, ...rest } = settings.customKeys;
                    void update({ customKeys: rest });
                  }}
                >
                  {ko.keys.remove}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ResetSection() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const load = useSettingsStore((s) => s.load);
  const reset = async () => {
    await repo.resetAll();
    await load();
    setStep(0);
    setDone(true);
  };
  return (
    <section className="rounded-lg bg-surface p-4" data-testid="reset-section">
      <h2 className="text-lg font-bold">{ko.settingsScreen.reset}</h2>
      {step === 0 && (
        <Button variant="secondary" className="mt-2" onClick={() => setStep(1)} data-testid="reset-start">
          {ko.settingsScreen.reset}
        </Button>
      )}
      {step > 0 && (
        <div
          role="alertdialog"
          aria-label={step === 1 ? ko.settingsScreen.resetConfirm1 : ko.settingsScreen.resetConfirm2}
          className="mt-2"
        >
          <p>{step === 1 ? ko.settingsScreen.resetConfirm1 : ko.settingsScreen.resetConfirm2}</p>
          <div className="mt-2 flex gap-2">
            <Button
              onClick={() => (step === 1 ? setStep(2) : void reset())}
              data-testid={`reset-confirm-${step}`}
            >
              {ko.settingsScreen.yes}
            </Button>
            <Button variant="secondary" onClick={() => setStep(0)}>
              {ko.settingsScreen.no}
            </Button>
          </div>
        </div>
      )}
      {done && (
        <p role="status" className="mt-2">
          {ko.settingsScreen.resetDone}
        </p>
      )}
    </section>
  );
}

/** Settings (SPEC §12.1). */
export function SettingsScreen() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  if (!settings) return <Screen title={ko.settingsScreen.title}>{null}</Screen>;
  const set = (patch: Partial<Settings>) => void update(patch);
  return (
    <Screen title={ko.settingsScreen.title}>
      <div className="flex flex-col gap-4">
        <section className="flex flex-wrap gap-2">
          <Link className={linkClass} to="/settings/diagnostics">
            {ko.settingsScreen.devices}
          </Link>
          <Link className={linkClass} to="/onboarding">
            {ko.settingsScreen.recalibrate}
          </Link>
          <Link className={linkClass} to="/settings/recording">
            {ko.settingsScreen.recording}
          </Link>
        </section>
        <p className="rounded-lg bg-surface p-3 text-info">{ko.settingsScreen.micNotice}</p>
        <section className="flex flex-col gap-2 rounded-lg bg-surface p-4">
          <fieldset>
            <legend className="font-semibold">{ko.settingsScreen.theme}</legend>
            <div className="flex flex-wrap gap-2">
              {(['dark', 'light', 'contrast'] as const).map((theme) => (
                <label key={theme} className="flex min-h-12 items-center gap-2">
                  <input
                    type="radio"
                    name="theme"
                    checked={settings.theme === theme}
                    onChange={() => set({ theme })}
                  />
                  {ko.settingsScreen.themes[theme]}
                </label>
              ))}
            </div>
          </fieldset>
          <Toggle
            label={ko.settingsScreen.leftHanded}
            checked={settings.leftHanded}
            onChange={(leftHanded) => set({ leftHanded })}
          />
          <label className="flex flex-col gap-1">
            <span className="font-semibold">{ko.settingsScreen.strictness}</span>
            <select
              className="min-h-12 rounded-lg bg-surface-2 px-3 text-fg"
              value={settings.strictness}
              onChange={(e) => set({ strictness: e.target.value as Settings['strictness'] })}
            >
              {(['lenient', 'normal', 'strict'] as const).map((s) => (
                <option key={s} value={s}>
                  {ko.settingsScreen.strictnessNames[s]}
                </option>
              ))}
            </select>
          </label>
          <Toggle
            label={ko.settingsScreen.visualOnly}
            checked={settings.visualOnlyMetronome}
            onChange={(visualOnlyMetronome) => set({ visualOnlyMetronome })}
          />
          <Toggle
            label={ko.settingsScreen.xStringCheck}
            checked={settings.xStringCheck}
            onChange={(xStringCheck) => set({ xStringCheck })}
          />
          <Toggle
            label={ko.settingsScreen.micDisabled}
            checked={settings.micDisabled}
            onChange={(micDisabled) => set({ micDisabled })}
            testId="setting-mic-disabled"
          />
          <label className="flex flex-col gap-1">
            <span className="font-semibold">{ko.settingsScreen.sessionMinutes}</span>
            <input
              type="number"
              min={5}
              max={90}
              className="min-h-12 w-32 rounded-lg bg-surface-2 px-3 text-fg"
              value={settings.sessionMinutes}
              onChange={(e) => {
                const v = Math.round(Number(e.target.value));
                if (v >= 5 && v <= 90) set({ sessionMinutes: v });
              }}
            />
          </label>
        </section>
        <KeysSection />
        <BackupSection />
        <ResetSection />
      </div>
    </Screen>
  );
}
