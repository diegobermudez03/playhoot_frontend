import styles from './GameWorkspace.module.css';

// Technical details from the backend (paths, codes and its own messages), shown as they came
// because they are for the creator's AI to act on (user-facing-text.md, allowed exceptions).
export function DiagnosticList({
  items,
}: {
  items: { where: string; code: string; message: string }[];
}) {
  return (
    <ul className={styles.diagnostics}>
      {items.map((item, index) => (
        <li key={index} className={styles.diagnostic}>
          {item.where && <code className={styles.diagnosticWhere}>{item.where}</code>}
          {item.code && <span className={styles.diagnosticCode}>{item.code}</span>}
          <span>{item.message}</span>
        </li>
      ))}
    </ul>
  );
}
