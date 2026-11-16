import type { MetaArgs, MetaDescriptor } from 'react-router';

import { publicMeta } from '../seo/meta';

export { SignInRoute as default } from '../features/sign-in/SignInRoute';

// A sign-in page is reached from a page, never from a search result.
export function meta(args: MetaArgs): MetaDescriptor[] {
  return publicMeta(args, {
    path: '/sign-in',
    titleId: 'seo.signIn.title',
    descriptionId: 'seo.signIn.description',
    noindex: true,
  });
}
