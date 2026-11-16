import type { AcceptanceText } from '@playhoot/communication';
import { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import { useServices } from '../../app/ServicesContext';
import { useLocale } from '../../i18n/LocaleContext';
import { segmentOfLocale } from '../../i18n/localePaths';
import { Button, Dialog } from '../../ui';
import { textName } from './AcceptanceGate';
import styles from './Compliance.module.css';

// The texts, linked where everyone can reach them (D-037): on the authentication screen's
// footer, whether or not anything is being asked. Each one is read in place, at the version
// published right now, and can be taken away as a file (P22§2). A kind nothing is published for
// says so rather than opening an empty page.
export function TextLinks({ kinds }: { kinds: readonly string[] }) {
  const intl = useIntl();
  const { compliance } = useServices();
  const { locale } = useLocale();
  const language = segmentOfLocale(locale);
  const [open, setOpen] = useState<{ kind: string; text: AcceptanceText | null } | null>(null);
  const [missing, setMissing] = useState(false);

  const read = async (kind: string) => {
    setOpen({ kind, text: null });
    setMissing(false);
    const result = await compliance.readText(kind, language);
    if (result.ok) setOpen({ kind, text: result.value });
    else setMissing(true);
  };

  return (
    <>
      <p className={styles.footerLinks}>
        {kinds.map((kind) => (
          <Button key={kind} variant="ghost" onClick={() => void read(kind)}>
            {textName(intl, kind)}
          </Button>
        ))}
      </p>
      <Dialog
        open={open !== null}
        title={open ? textName(intl, open.kind) : ''}
        closeLabel={intl.formatMessage({ id: 'acceptance.close' })}
        onClose={() => {
          setOpen(null);
          setMissing(false);
        }}
        actions={
          open?.text ? (
            <a
              className={styles.download}
              href={compliance.textDownloadUrl(open.kind, open.text.language)}
              download
            >
              <FormattedMessage id="texts.download" />
            </a>
          ) : null
        }
      >
        {missing ? (
          <p className={styles.notice}>
            <FormattedMessage id="texts.notPublished" />
          </p>
        ) : open?.text ? (
          <>
            <p className={styles.version}>
              <FormattedMessage id="acceptance.version" values={{ version: open.text.version }} />
            </p>
            <p className={styles.textContent}>{open.text.content}</p>
          </>
        ) : (
          <p className={styles.notice}>
            <FormattedMessage id="texts.loading" />
          </p>
        )}
      </Dialog>
    </>
  );
}
