import { Link, useLocation } from 'react-router';
import { ko } from '../i18n/ko';
import { Icon, type IconName } from '../ui/icons';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  /** Path prefixes that belong to this tab (its sub-screens light it up too). */
  owns: readonly string[];
}

const TABS: readonly NavItem[] = [
  { to: '/', label: ko.nav.home, icon: 'home', owns: ['/routine'] },
  { to: '/curriculum', label: ko.nav.curriculum, icon: 'path', owns: ['/curriculum', '/exam'] },
  { to: '/tools', label: ko.nav.tools, icon: 'tools', owns: ['/tools', '/tuner', '/metronome', '/library'] },
  { to: '/progress', label: ko.nav.progress, icon: 'chart', owns: ['/progress'] },
  { to: '/settings', label: ko.nav.settings, icon: 'settings', owns: ['/settings'] },
];

/** Tools listed under their tab in the sidebar, so the wide layout reaches them in one click. */
const TOOLS: readonly NavItem[] = [
  { to: '/tuner', label: ko.nav.tuner, icon: 'tuner', owns: ['/tuner'] },
  { to: '/metronome', label: ko.nav.metronome, icon: 'metronome', owns: ['/metronome'] },
  { to: '/library', label: ko.nav.library, icon: 'chord', owns: ['/library'] },
];

const owns = (item: NavItem, path: string) =>
  path === item.to || item.owns.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

/**
 * Main navigation (D-087): one landmark that is a bottom tab bar below `lg` (iPhone, iPad portrait) and a
 * left sidebar from `lg` (iPad landscape, MacBook). Practice screens render without it (focus mode).
 */
export function AppNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label={ko.nav.main}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-t-0 lg:px-3 lg:pb-6 lg:pt-8"
    >
      <p className="mb-8 hidden items-center gap-2.5 px-3 text-lg font-bold tracking-tight lg:flex">
        <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-fg">
          <Icon name="chord" size={18} />
        </span>
        {ko.app.title}
      </p>
      <ul className="mx-auto flex max-w-xl lg:mx-0 lg:block lg:max-w-none lg:space-y-1">
        {TABS.map((tab) => {
          const active = owns(tab, pathname);
          return (
            <li key={tab.to} className="flex-1">
              <Link
                to={tab.to}
                // A tool screen lights its parent tab: the tab is "in" the current page, not the page itself.
                aria-current={pathname === tab.to ? 'page' : active ? 'true' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-xs font-semibold lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm ${
                  active ? 'text-accent lg:bg-accent-soft' : 'text-muted hover:text-fg'
                }`}
              >
                <Icon name={tab.icon} size={22} />
                {tab.label}
              </Link>
              {tab.to === '/tools' && (
                <ul className="mb-2 mt-1 hidden space-y-1 lg:block">
                  {TOOLS.map((tool) => {
                    const toolActive = owns(tool, pathname);
                    return (
                      <li key={tool.to}>
                        <Link
                          to={tool.to}
                          aria-current={toolActive ? 'page' : undefined}
                          className={`flex min-h-11 items-center gap-3 rounded-lg pl-11 pr-3 text-sm ${
                            toolActive ? 'font-semibold text-fg' : 'text-muted hover:text-fg'
                          }`}
                        >
                          {tool.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
