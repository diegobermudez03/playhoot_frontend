import type { ActionResult, GameAuthoring } from '@playhoot/feature-game-authoring';
import { FormattedMessage } from 'react-intl';

import { Button } from '../../ui';
import { DiagnosticList } from './DiagnosticList';
import styles from './GameWorkspace.module.css';

// How the last action ended, with what to do next.
export function ActionResultNotice({
  result,
  authoring,
}: {
  result: ActionResult;
  authoring: GameAuthoring;
}) {
  const ok = result.kind === 'applied' || result.kind === 'unchanged';
  return (
    <div
      className={`${styles.notice} ${ok ? styles.noticeOk : styles.noticeError}`}
      role={ok ? 'status' : 'alert'}
      data-testid="action-result"
      data-kind={result.kind}
    >
      <p>{message(result)}</p>
      {(result.kind === 'invalid' || result.kind === 'too-large') &&
        result.diagnostics.length > 0 && (
          <DiagnosticList
            items={result.diagnostics.map((diagnostic) => ({
              where: diagnostic.path,
              code: diagnostic.code,
              message: diagnostic.message,
            }))}
          />
        )}
      <div className={styles.noticeActions}>
        {result.kind === 'conflict' && (
          <Button size="md" onClick={() => void authoring.reload().then(authoring.dismissResult)}>
            <FormattedMessage id="result.reload" />
          </Button>
        )}
        <Button size="md" variant="ghost" onClick={authoring.dismissResult}>
          <FormattedMessage id="result.dismiss" />
        </Button>
      </div>
    </div>
  );
}

function message(result: ActionResult) {
  switch (result.kind) {
    case 'applied':
      return <FormattedMessage id="result.applied" values={{ revision: result.revision }} />;
    case 'unchanged':
      return <FormattedMessage id="result.unchanged" />;
    case 'conflict':
      return <FormattedMessage id="result.conflict" />;
    case 'invalid':
      return <FormattedMessage id="result.invalid" />;
    case 'too-large':
      return <FormattedMessage id="result.tooLarge" />;
    case 'not-declared':
      return <FormattedMessage id="result.notDeclared" />;
    case 'not-editable':
      return <FormattedMessage id="result.notEditable" />;
    case 'busy':
      return (
        <FormattedMessage id="result.busy" values={{ seconds: result.retryAfterSeconds ?? 0 }} />
      );
    default:
      return <FormattedMessage id="result.failed" />;
  }
}
