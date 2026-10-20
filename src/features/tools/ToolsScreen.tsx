import { Link } from 'react-router';
import { ko } from '../../i18n/ko';
import { Icon, type IconName } from '../../ui/icons';
import { Screen } from '../../ui/Screen';

const TOOLS: readonly { to: string; icon: IconName; title: string; text: string }[] = [
  { to: '/tuner', icon: 'tuner', title: ko.tuner.title, text: ko.tools.tunerText },
  { to: '/metronome', icon: 'metronome', title: ko.metronome.title, text: ko.tools.metronomeText },
  { to: '/library', icon: 'chord', title: ko.tools.library, text: ko.tools.libraryText },
];

/** "도구" tab (D-087): the stand-alone tools the tab bar groups, one big tile each. */
export function ToolsScreen() {
  return (
    <Screen title={ko.tools.title} width="wide">
      <ul className="grid gap-4 sm:grid-cols-3">
        {TOOLS.map((tool) => (
          <li key={tool.to}>
            <Link
              to={tool.to}
              className="card flex h-full flex-col gap-3 rounded-2xl border border-border bg-surface p-5 transition-[border-color] hover:border-accent"
            >
              <span className="grid size-12 place-items-center rounded-xl bg-accent-soft text-accent">
                <Icon name={tool.icon} size={26} />
              </span>
              <span className="text-lg font-bold">{tool.title}</span>
              <span className="text-sm text-muted">{tool.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
