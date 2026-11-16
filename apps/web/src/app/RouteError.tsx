import { useEffect } from 'react';
import { FormattedMessage } from 'react-intl';
import { isRouteErrorResponse, useRouteError } from 'react-router';

import { useLocalePaths } from '../i18n/useLocalePaths';
import { useOptionalServices } from './ServicesContext';
import { Button, Stage } from '../ui';
import { Notice } from './Notice';

// Presentation error boundary: a render failure in one route never takes the shell down.
export function RouteError() {
  const error = useRouteError();
  // The app may not exist yet (the failure happened before hydration took over).
  const services = useOptionalServices();
  const paths = useLocalePaths();
  // A route answering an error status is not a render failure; anything thrown is.
  const crashed = !isRouteErrorResponse(error);
  useEffect(() => {
    if (crashed) services?.telemetry.presentationFailed();
  }, [crashed, services]);
  // Technical detail, not translated: useful when someone reports the problem.
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : null;
  return (
    <>
      <Stage>
        <Notice title={<FormattedMessage id="error.title" />} body={detail} mood="surprised">
          <Button size="lg" onClick={() => window.location.assign(paths.home)}>
            <FormattedMessage id="common.goHome" />
          </Button>
        </Notice>
      </Stage>
    </>
  );
}
