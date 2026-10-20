import { isRouteErrorResponse, useRouteError } from 'react-router';

// Presentation error boundary: a render failure in one route never takes the shell down.
export function RouteError() {
  const error = useRouteError();
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error';
  return (
    <main>
      <h1>Something went wrong</h1>
      <p>{detail}</p>
    </main>
  );
}
