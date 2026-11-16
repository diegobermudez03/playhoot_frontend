import { FormattedMessage } from 'react-intl';
import { useNavigate } from 'react-router';

import { useLocalePaths } from '../i18n/useLocalePaths';
import { Button, Stage } from '../ui';
import { Notice } from './Notice';

export function NotFoundRoute() {
  const navigate = useNavigate();
  const paths = useLocalePaths();
  return (
    <>
      <Stage>
        <Notice
          title={<FormattedMessage id="notFound.title" />}
          body={<FormattedMessage id="notFound.body" />}
        >
          <Button size="lg" onClick={() => navigate(paths.home)}>
            <FormattedMessage id="common.goHome" />
          </Button>
        </Notice>
      </Stage>
    </>
  );
}
