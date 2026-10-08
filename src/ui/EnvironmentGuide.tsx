/** Recording-environment guide (SPEC v1.1 §9.3, research 02:73·100, 03:77) for onboarding and diagnostics. */
import { ko } from '../i18n/ko';

export function EnvironmentGuide() {
  return (
    <section className="rounded-lg bg-surface-2 p-3" data-testid="environment-guide">
      <h3 className="font-semibold">{ko.environmentGuide.title}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {ko.environmentGuide.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
