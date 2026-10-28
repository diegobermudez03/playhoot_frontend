import { useServices } from '../app/ServicesContext';
import styles from './DevIdentityPicker.module.css';

// The backend's placeholder Identity knows these fixed account tokens (BACKEND_CONTRACT.md G3).
// Every guest is the same user there, so a second player on one machine needs a test account.
const devAccounts = [
  { token: 'test-user-1', userUUID: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001', name: 'Test user 1' },
  { token: 'test-user-2', userUUID: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002', name: 'Test user 2' },
] as const;

// Development only, on the sign-in page: never rendered in production builds. Signing in makes the
// page continue to where the person was going.
export function DevIdentityPicker() {
  const { app } = useServices();
  return (
    <div className={styles.dev}>
      <p className={styles.label}>Dev · sign in with a test account</p>
      <div className={styles.row}>
        {devAccounts.map((account) => (
          <button
            key={account.token}
            type="button"
            className={styles.chip}
            onClick={() =>
              app.signIn({
                token: account.token,
                userUUID: account.userUUID,
                kind: 'account',
                displayName: account.name,
              })
            }
          >
            {account.name}
          </button>
        ))}
      </div>
    </div>
  );
}
