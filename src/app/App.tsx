import { useEffect } from 'react';
import { createHashRouter, NavLink, Outlet, RouterProvider } from 'react-router';
import { CurriculumScreen, StageScreen } from '../features/curriculum/CurriculumScreen';
import { ExamScreen } from '../features/curriculum/ExamScreen';
import { StagePracticeScreen } from '../features/curriculum/StagePractice';
import { HomeScreen } from '../features/home/HomeScreen';
import { ChordDetailScreen, LibraryScreen } from '../features/library/LibraryScreen';
import { MetronomeScreen } from '../features/metronome/MetronomeScreen';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { PracticeScreen } from '../features/practice/PracticeScreen';
import { ProgressScreen } from '../features/progress/ProgressScreen';
import { RecordingKitScreen } from '../features/recording/RecordingKitScreen';
import { RoutineEditorScreen } from '../features/routineEditor/RoutineEditorScreen';
import { SessionScreen } from '../features/session/SessionScreen';
import { DiagnosticsScreen } from '../features/settings/DiagnosticsScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { TunerScreen } from '../features/tuner/TunerScreen';
import { ko } from '../i18n/ko';
import { PwaRegistration } from './pwa';
import { useSettingsStore } from './settingsStore';

const NAV = [
  { to: '/', label: ko.nav.home },
  { to: '/curriculum', label: ko.nav.curriculum },
  { to: '/library', label: ko.nav.library },
  { to: '/tuner', label: ko.nav.tuner },
  { to: '/metronome', label: ko.nav.metronome },
  { to: '/progress', label: ko.nav.progress },
  { to: '/settings', label: ko.nav.settings },
] as const;

function AppLayout() {
  const settings = useSettingsStore((s) => s.settings);
  const load = useSettingsStore((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    document.documentElement.dataset.theme = settings?.theme ?? 'dark';
  }, [settings?.theme]);
  if (!settings) return null;
  return (
    <>
      {/* Hash routing owns the URL fragment, so the skip control moves focus instead of navigating. */}
      <button
        type="button"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-accent focus:p-2 focus:text-accent-fg"
        onClick={() => {
          const main = document.getElementById('main');
          main?.setAttribute('tabindex', '-1');
          main?.focus();
        }}
      >
        {ko.app.skipToContent}
      </button>
      <header className="border-b border-surface-2">
        <nav aria-label={ko.nav.main} className="mx-auto flex max-w-3xl flex-wrap gap-1 p-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `inline-flex min-h-12 items-center rounded-lg px-3 ${isActive ? 'bg-surface-2 font-semibold' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <PwaRegistration />
      <Outlet />
    </>
  );
}

const router = createHashRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomeScreen /> },
      { path: '/onboarding', element: <OnboardingScreen /> },
      { path: '/tuner', element: <TunerScreen /> },
      { path: '/metronome', element: <MetronomeScreen /> },
      { path: '/settings', element: <SettingsScreen /> },
      { path: '/settings/diagnostics', element: <DiagnosticsScreen /> },
      { path: '/settings/recording', element: <RecordingKitScreen /> },
      { path: '/practice/:type', element: <PracticeScreen /> },
      { path: '/session', element: <SessionScreen /> },
      { path: '/routine/edit', element: <RoutineEditorScreen /> },
      { path: '/curriculum', element: <CurriculumScreen /> },
      { path: '/curriculum/:stage', element: <StageScreen /> },
      { path: '/curriculum/:stage/practice/:option', element: <StagePracticeScreen /> },
      { path: '/exam', element: <ExamScreen /> },
      { path: '/progress', element: <ProgressScreen /> },
      { path: '/library', element: <LibraryScreen /> },
      { path: '/library/:id', element: <ChordDetailScreen /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
