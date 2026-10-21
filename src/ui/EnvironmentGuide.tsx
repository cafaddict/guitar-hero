/** Recording-environment guide (SPEC v1.1 §9.3, research 02:73·100, 03:77) for onboarding and diagnostics. */
import { ko } from '../i18n/ko';
import { Card } from './Card';

/** `level`: the heading's rank where it sits (2 straight under a screen's h1, 3 inside a titled step). */
export function EnvironmentGuide({ level = 3 }: { level?: 2 | 3 }) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <Card as="section" tone="info" data-testid="environment-guide">
      <Heading className="font-semibold">{ko.environmentGuide.title}</Heading>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        {ko.environmentGuide.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Card>
  );
}
