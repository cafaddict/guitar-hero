import { Link, Navigate } from 'react-router';
import { useSettingsStore } from '../../app/settingsStore';
import { ko } from '../../i18n/ko';
import { Screen } from '../../ui/Screen';

/** The first-run redirect happens once per page load; "나중에 하기" then leaves the user on home. */
let firstRunRedirectDone = false;

/** Home (M6 replaces the body with today's routine). First run → onboarding. */
export function HomeScreen() {
  const settings = useSettingsStore((s) => s.settings);
  const needsOnboarding = settings !== null && !settings.micOnboardingDone && !settings.micDisabled;
  if (needsOnboarding && !firstRunRedirectDone) {
    firstRunRedirectDone = true;
    return <Navigate to="/onboarding" replace />;
  }
  return (
    <Screen title={ko.app.title}>
      {needsOnboarding && (
        <section className="mb-4 rounded-lg bg-surface p-4">
          <p>{ko.home.firstRun}</p>
          <Link
            className="mt-3 inline-flex min-h-12 items-center rounded-lg bg-accent px-4 font-semibold text-accent-fg"
            to="/onboarding"
          >
            {ko.home.startOnboarding}
          </Link>
        </section>
      )}
      <p className="text-muted">{ko.home.comingSoon}</p>
    </Screen>
  );
}
