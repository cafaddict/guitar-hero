import { useEffect } from 'react';
import { createHashRouter, Outlet, RouterProvider } from 'react-router';
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
import { ToolsScreen } from '../features/tools/ToolsScreen';
import { TunerScreen } from '../features/tuner/TunerScreen';
import { ko } from '../i18n/ko';
import { AppNav } from './AppNav';
import { PwaRegistration } from './pwa';
import { useSettingsStore } from './settingsStore';

/** Theme and settings for every route; the skip control and the PWA worker live here once. */
function RootLayout() {
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
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-30 focus:rounded focus:bg-accent focus:p-2 focus:text-accent-fg"
        onClick={() => {
          const main = document.getElementById('main');
          main?.setAttribute('tabindex', '-1');
          main?.focus();
        }}
      >
        {ko.app.skipToContent}
      </button>
      <PwaRegistration />
      <Outlet />
    </>
  );
}

/** Screens with the app navigation; the bottom padding keeps content clear of the tab bar below `lg`. */
function ShellLayout() {
  return (
    <div className="lg:flex">
      <AppNav />
      <div className="min-w-0 flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] [--pinned-bottom:calc(var(--tabbar-h)+env(safe-area-inset-bottom)+0.5rem)] lg:pb-0">
        <Outlet />
      </div>
    </div>
  );
}

const router = createHashRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <ShellLayout />,
        children: [
          { path: '/', element: <HomeScreen /> },
          { path: '/onboarding', element: <OnboardingScreen /> },
          { path: '/tools', element: <ToolsScreen /> },
          { path: '/tuner', element: <TunerScreen /> },
          { path: '/metronome', element: <MetronomeScreen /> },
          { path: '/settings', element: <SettingsScreen /> },
          { path: '/settings/diagnostics', element: <DiagnosticsScreen /> },
          { path: '/settings/recording', element: <RecordingKitScreen /> },
          { path: '/routine/edit', element: <RoutineEditorScreen /> },
          { path: '/curriculum', element: <CurriculumScreen /> },
          { path: '/curriculum/:stage', element: <StageScreen /> },
          { path: '/exam', element: <ExamScreen /> },
          { path: '/progress', element: <ProgressScreen /> },
          { path: '/library', element: <LibraryScreen /> },
          { path: '/library/:id', element: <ChordDetailScreen /> },
        ],
      },
      // Focus mode (D-087): practice screens bring their own slim header instead of the navigation.
      { path: '/practice/:type', element: <PracticeScreen /> },
      { path: '/session', element: <SessionScreen /> },
      { path: '/curriculum/:stage/practice/:option', element: <StagePracticeScreen /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
