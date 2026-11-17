import { createMyData } from '@playhoot/feature-account';
import { operations } from '@playhoot/protocol';
import { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useNavigate } from 'react-router';

import { useNavigateToOperation } from '../../features/access';
import { teacherPath } from '../../features/paths';
import type { MessageId } from '../../i18n/catalogs';
import { useLocalePaths } from '../../i18n/useLocalePaths';
import { Button, Dialog, ModeSwitch } from '../../ui';
import { useAuth, useOptionalServices, useServices } from '../ServicesContext';

// The three ways of using Playhoot (P03§9). Teacher is real for an account since H3: choosing it
// asks the backend for the mode and lands on the teacher screen, and the mode is remembered on
// the account, so it survives a reload and every sign-in. Student still explains that it arrives
// with H8 and leaves the person where they are. A guest is always normal, so choosing teacher
// sends them through the sign-in screen first.
type Mode = 'normal' | 'teacher' | 'student';

const explanations: Record<'student', { title: MessageId; body: MessageId }> = {
  student: { title: 'mode.student.title', body: 'mode.student.body' },
};

export function ModeChoice({
  className,
  size = 'md',
}: {
  className?: string | undefined;
  size?: 'sm' | 'md';
}) {
  // The server renders the bar before the app exists; the mode is known only in the browser, so
  // until then the switch shows the one every visitor starts in.
  return useOptionalServices() ? (
    <LiveModeChoice className={className} size={size} />
  ) : (
    <ModeSwitchShell value="normal" onChange={() => undefined} className={className} size={size} />
  );
}

function LiveModeChoice({
  className,
  size,
}: {
  className?: string | undefined;
  size: 'sm' | 'md';
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const paths = useLocalePaths();
  const goToOperation = useNavigateToOperation();
  const { app, me, identity } = useServices();
  const [feature] = useState(() => createMyData({ app, me, identity }));
  const [asked, setAsked] = useState<'student' | null>(null);
  const explanation = asked ? explanations[asked] : null;
  const value: Mode =
    auth.status === 'authenticated' && auth.mode === 'teacher' ? 'teacher' : 'normal';

  const choose = (mode: Mode) => {
    if (mode === 'student') {
      setAsked('student');
      return;
    }
    if (mode === value) return;
    if (mode === 'teacher') {
      // The teacher screen asks for the mode itself, so a person who arrives there any other
      // way (a link, a reload) is in teacher mode just the same.
      goToOperation(operations.setOwnMode, teacherPath, 'teach');
      return;
    }
    void feature.setMode('normal').then((done) => {
      if (done) void navigate(paths.home);
    });
  };

  return (
    <>
      <ModeSwitchShell value={value} onChange={choose} className={className} size={size} />
      <ModeDialog explanation={explanation} onClose={() => setAsked(null)} />
    </>
  );
}

function ModeSwitchShell({
  value,
  onChange,
  className,
  size,
}: {
  value: Mode;
  onChange: (mode: Mode) => void;
  className?: string | undefined;
  size: 'sm' | 'md';
}) {
  const intl = useIntl();
  return (
    <ModeSwitch
      label={intl.formatMessage({ id: 'mode.label' })}
      value={value}
      size={size}
      onChange={onChange}
      {...(className ? { className } : {})}
      options={[
        { value: 'normal', label: intl.formatMessage({ id: 'mode.normal' }) },
        { value: 'teacher', label: intl.formatMessage({ id: 'mode.teacher' }) },
        { value: 'student', label: intl.formatMessage({ id: 'mode.student' }) },
      ]}
    />
  );
}

function ModeDialog({
  explanation,
  onClose,
}: {
  explanation: { title: MessageId; body: MessageId } | null;
  onClose: () => void;
}) {
  const intl = useIntl();
  return (
    <Dialog
      open={explanation !== null}
      title={explanation ? intl.formatMessage({ id: explanation.title }) : ''}
      closeLabel={intl.formatMessage({ id: 'common.close' })}
      onClose={onClose}
      actions={
        <Button onClick={onClose}>
          <FormattedMessage id="common.gotIt" />
        </Button>
      }
    >
      {explanation && <FormattedMessage id={explanation.body} />}
    </Dialog>
  );
}
