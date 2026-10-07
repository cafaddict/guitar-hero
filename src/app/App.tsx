import { createHashRouter, RouterProvider } from 'react-router';
import { DiagnosticsScreen } from '../features/settings/DiagnosticsScreen';
import { ko } from '../i18n/ko';

function HomePlaceholder() {
  return (
    <main id="main" className="p-4">
      <h1 className="text-2xl font-bold">{ko.app.title}</h1>
    </main>
  );
}

const router = createHashRouter([
  { path: '/', element: <HomePlaceholder /> },
  { path: '/settings/diagnostics', element: <DiagnosticsScreen /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
