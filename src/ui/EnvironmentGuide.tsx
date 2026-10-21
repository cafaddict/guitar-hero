/** Recording-environment guide (SPEC v1.1 §9.3, research 02:73·100, 03:77) for onboarding and diagnostics. */
import { ko } from '../i18n/ko';
import { Card } from './Card';

export function EnvironmentGuide() {
  return (
    <Card as="section" tone="info" data-testid="environment-guide">
      <h3 className="font-semibold">{ko.environmentGuide.title}</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        {ko.environmentGuide.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Card>
  );
}
