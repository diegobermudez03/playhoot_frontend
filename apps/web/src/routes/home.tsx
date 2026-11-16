import type { MetaArgs, MetaDescriptor } from 'react-router';

import { HomeScreen } from '../features/home/HomeScreen';
import { useMediaLayout } from '../features/layout';
import { homeJsonLd, publicMeta } from '../seo/meta';

export function meta(args: MetaArgs): MetaDescriptor[] {
  return publicMeta(args, {
    path: '/',
    titleId: 'seo.home.title',
    descriptionId: 'seo.home.description',
    jsonLd: homeJsonLd,
  });
}

// `/{language}`: the public entry (P14§1). It renders entirely on the server and needs nothing
// from the browser, so it is written out as a file at build time and a search engine reads the
// whole page. The layout is chosen here, at the route's edge: the server has no display to ask
// about, so it renders the compact implementation and the browser picks the other one when the
// display is a landscape one with room.
export default function Home() {
  return <HomeScreen layout={useMediaLayout()} />;
}
