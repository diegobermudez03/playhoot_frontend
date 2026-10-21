import { startGameHost, type GameHostEvent, type GameHostStatus } from '@playhoot/game-host';
import { useEffect, useRef, useState } from 'react';

import { useServices } from '../app/ServicesContext';
import { createIframeGameContainer } from '../platform/iframeGameContainer';
import { AppShell, Button, Card } from '../ui';
import { createFakeSpaceDriftSession, type FakeSession } from './fakeSpaceDriftSession';
import styles from './GameHostLabRoute.module.css';

// Development only: runs the Space Drift fixture artifact (fixtures/games/space-drift, built with
// `npm run fixtures`) in the real WebGameHost against a fake local Session, to see the bridge
// working in a browser before Session Play exists: verification, sandbox, READY, projections,
// samples, commands, events, assets, failures.
const fixture = '/__fixtures/games/space-drift';
const me = 'participant-me';
const bot = 'participant-bot';

const shipSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
<path d="M38 20 L6 6 L13 20 L6 34 Z" fill="#ffd166" stroke="#fff" stroke-width="2"/></svg>`;

type Run = { id: number; wrongHash: boolean };

export function GameHostLabRoute() {
  const services = useServices();
  const box = useRef<HTMLDivElement>(null);
  const session = useRef<FakeSession | null>(null);
  const [sha256, setSha256] = useState<string | null | 'missing'>(null);
  const [run, setRun] = useState<Run>({ id: 1, wrongHash: false });
  const [status, setStatus] = useState<GameHostStatus>({ phase: 'loading' });
  const [events, setEvents] = useState<GameHostEvent[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const dispose = useRef<() => void>(() => undefined);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${fixture}/artifact.json`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
      .then((artifact: { sha256: string }) => !cancelled && setSha256(artifact.sha256))
      .catch(() => !cancelled && setSha256('missing'));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const parent = box.current;
    if (!parent || sha256 === null || sha256 === 'missing') return;
    const fake = createFakeSpaceDriftSession(me, bot);
    session.current = fake;
    setEvents([]);
    const host = startGameHost({
      artifact: { url: `${fixture}/index.html`, sha256: run.wrongHash ? '0'.repeat(64) : sha256 },
      loader: services.gameArtifacts,
      viewport: { aspectRatio: '16:9', width: 1920, height: 1080 },
      container: createIframeGameContainer(parent, 'Space Drift'),
      session: fake,
      context: { participantId: me, participants: [me, bot], locale: 'es' },
      assets: {
        resolve: (key) =>
          Promise.resolve(
            key === 'ship'
              ? { mimeType: 'image/svg+xml', bytes: new TextEncoder().encode(shipSvg).buffer }
              : null,
          ),
      },
    });
    setStatus(host.status);
    host.subscribe((event) => {
      if (event.type === 'status') setStatus(event.status);
      else setEvents((previous) => [event, ...previous].slice(0, 30));
    });
    const refresh = setInterval(() => setLog(fake.log.slice(0, 12)), 250);
    dispose.current = () => {
      host.dispose();
      setStatus(host.status);
    };
    return () => {
      clearInterval(refresh);
      host.dispose();
      fake.dispose();
    };
  }, [sha256, run, services.gameArtifacts]);

  return (
    <AppShell>
      <div className={styles.page}>
        <header>
          <h1>GameHost lab</h1>
          <p className={styles.muted}>
            Dev only. Space Drift fixture in the sandboxed iframe, fake local Session. Keys: WASD /
            arrows, Shift boosts; drag to steer; double click teleports.
          </p>
        </header>
        {sha256 === 'missing' && (
          <Card>
            <p>
              The fixture is not built. Run <code>npm run fixtures</code> and reload.
            </p>
          </Card>
        )}
        <div className={styles.layout}>
          <div className={styles.viewport} ref={box} />
          <div className={styles.side}>
            <Card>
              <p>
                Status: <strong>{status.phase}</strong>
                {status.phase === 'running' && ` (bridge v${status.version})`}
                {status.phase === 'failed' && ` — ${JSON.stringify(status.error)}`}
              </p>
              <div className={styles.buttons}>
                <Button
                  size="md"
                  onClick={() => setRun((r) => ({ id: r.id + 1, wrongHash: false }))}
                >
                  Restart
                </Button>
                <Button size="md" variant="secondary" onClick={() => session.current?.resync()}>
                  Resync (FULL)
                </Button>
                <Button
                  size="md"
                  variant="secondary"
                  onClick={() => setRun((r) => ({ id: r.id + 1, wrongHash: true }))}
                >
                  Wrong hash
                </Button>
                <Button size="md" variant="danger" onClick={() => dispose.current()}>
                  Dispose
                </Button>
              </div>
            </Card>
            <Card>
              <h2 className={styles.title}>Host events</h2>
              <ul className={styles.list}>
                {events.map((event, index) => (
                  <li key={index}>{JSON.stringify(event)}</li>
                ))}
              </ul>
            </Card>
            <Card>
              <h2 className={styles.title}>Sent to the Session</h2>
              <ul className={styles.list}>
                {log.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
