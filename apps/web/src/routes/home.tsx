import { FormattedMessage } from 'react-intl';
import { Link, type MetaArgs, type MetaDescriptor } from 'react-router';

import { useLocalePaths } from '../i18n/useLocalePaths';
import { newGamePath } from '../features/paths';
import { homeJsonLd, publicMeta } from '../seo/meta';
import { AppShell, Card, Logo, Stage } from '../ui';
import styles from './home.module.css';

export function meta(args: MetaArgs): MetaDescriptor[] {
  return publicMeta(args, {
    path: '/',
    titleId: 'seo.home.title',
    descriptionId: 'seo.home.description',
    jsonLd: homeJsonLd,
  });
}

// `/{language}`: the public entry. This is the rendering and SEO base of the home screen, not the
// screen itself: T-204 builds its content (hero, join code, Discovery, teacher band) on top of
// what is here. It renders entirely on the server and needs nothing from the browser, so it is
// written out as a file at build time.
export default function Home() {
  const paths = useLocalePaths();
  return (
    <AppShell>
      <Stage>
        <div className={styles.hero}>
          <Logo size="lg" />
          <h1 className={styles.title}>
            <FormattedMessage id="home.title" />
          </h1>
          <p className={styles.intro}>
            <FormattedMessage id="home.intro" />
          </p>
        </div>
        <Card>
          <div className={styles.actions}>
            <Link className={styles.primary} to={paths.enterCode}>
              <FormattedMessage id="home.join" />
            </Link>
            <Link className={styles.secondary} to={newGamePath}>
              <FormattedMessage id="home.create" />
            </Link>
          </div>
        </Card>
      </Stage>
    </AppShell>
  );
}
