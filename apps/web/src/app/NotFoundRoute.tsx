import { FormattedMessage } from 'react-intl';
import { useNavigate } from 'react-router';

import { AppShell, Button, Stage } from '../ui';
import { Notice } from './Notice';

export function NotFoundRoute() {
  const navigate = useNavigate();
  return (
    <AppShell>
      <Stage>
        <Notice
          title={<FormattedMessage id="notFound.title" />}
          body={<FormattedMessage id="notFound.body" />}
        >
          <Button size="lg" onClick={() => navigate('/')}>
            <FormattedMessage id="common.goHome" />
          </Button>
        </Notice>
      </Stage>
    </AppShell>
  );
}
