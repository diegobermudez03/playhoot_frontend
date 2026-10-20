import { FormattedMessage } from 'react-intl';
import { isRouteErrorResponse, useRouteError } from 'react-router';

import { AppShell, Button, Stage } from '../ui';
import { Notice } from './Notice';

// Presentation error boundary: a render failure in one route never takes the shell down.
export function RouteError() {
  const error = useRouteError();
  // Technical detail, not translated: useful when someone reports the problem.
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : null;
  return (
    <AppShell>
      <Stage>
        <Notice title={<FormattedMessage id="error.title" />} body={detail} mood="surprised">
          <Button size="lg" onClick={() => window.location.assign('/')}>
            <FormattedMessage id="common.goHome" />
          </Button>
        </Notice>
      </Stage>
    </AppShell>
  );
}
