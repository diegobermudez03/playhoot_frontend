import type { MetaArgs, MetaDescriptor } from 'react-router';

import { appMeta } from '../seo/meta';

export { AdminSignInRoute as default } from '../features/admin/AdminSignInRoute';

export function meta(args: MetaArgs): MetaDescriptor[] {
  return appMeta(args, 'seo.admin.signIn.title');
}
