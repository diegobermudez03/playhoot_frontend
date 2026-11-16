import type { MetaArgs, MetaDescriptor } from 'react-router';

import { appMeta } from '../seo/meta';

export { AdminHomeRoute as default } from '../features/admin/AdminHomeRoute';

export function meta(args: MetaArgs): MetaDescriptor[] {
  return appMeta(args, 'seo.admin.overview.title');
}
