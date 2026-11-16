import type { MetaArgs, MetaDescriptor } from 'react-router';

import { appMeta } from '../seo/meta';

export { AdminEmailRoute as default } from '../features/admin/AdminEmailRoute';

export function meta(args: MetaArgs): MetaDescriptor[] {
  return appMeta(args, 'seo.admin.email.title');
}
