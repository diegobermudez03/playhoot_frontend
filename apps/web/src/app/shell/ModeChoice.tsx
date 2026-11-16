import { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import type { MessageId } from '../../i18n/catalogs';
import { Button, Dialog, ModeSwitch } from '../../ui';

// The three modes of P03§9: the general account plays and teaches, a student is an identity of
// their own. Only the normal mode exists today, so choosing another explains what it will be and
// leaves the person where they are — the switch is visible from the start because it is how the
// product says these three ways of using it exist (B: search, P14§1).
type Mode = 'normal' | 'teacher' | 'student';

const explanations: Record<Exclude<Mode, 'normal'>, { title: MessageId; body: MessageId }> = {
  teacher: { title: 'mode.teacher.title', body: 'mode.teacher.body' },
  student: { title: 'mode.student.title', body: 'mode.student.body' },
};

export function ModeChoice({
  className,
  size = 'md',
}: {
  className?: string | undefined;
  size?: 'sm' | 'md';
}) {
  const intl = useIntl();
  const [asked, setAsked] = useState<Exclude<Mode, 'normal'> | null>(null);
  const explanation = asked ? explanations[asked] : null;
  return (
    <>
      <ModeSwitch
        label={intl.formatMessage({ id: 'mode.label' })}
        value="normal"
        size={size}
        onChange={(mode: Mode) => setAsked(mode === 'normal' ? null : mode)}
        {...(className ? { className } : {})}
        options={[
          { value: 'normal', label: intl.formatMessage({ id: 'mode.normal' }) },
          { value: 'teacher', label: intl.formatMessage({ id: 'mode.teacher' }) },
          { value: 'student', label: intl.formatMessage({ id: 'mode.student' }) },
        ]}
      />
      <Dialog
        open={explanation !== null}
        title={explanation ? intl.formatMessage({ id: explanation.title }) : ''}
        closeLabel={intl.formatMessage({ id: 'common.close' })}
        onClose={() => setAsked(null)}
        actions={
          <Button onClick={() => setAsked(null)}>
            <FormattedMessage id="common.gotIt" />
          </Button>
        }
      >
        {explanation && <FormattedMessage id={explanation.body} />}
      </Dialog>
    </>
  );
}
