import type { MetaArgs, MetaDescriptor } from 'react-router';

import { publicMeta } from '../seo/meta';

export { GuestSignInRoute as default } from '../features/sign-in/GuestSignInRoute';

export function meta(args: MetaArgs): MetaDescriptor[] {
  return publicMeta(args, {
    path: '/sign-in/guest',
    titleId: 'seo.signInGuest.title',
    descriptionId: 'seo.signInGuest.description',
    noindex: true,
  });
}
