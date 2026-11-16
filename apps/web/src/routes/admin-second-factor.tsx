import type { MetaArgs, MetaDescriptor } from 'react-router';

import { appMeta } from '../seo/meta';

export { AdminSecondFactorRoute as default } from '../features/admin/AdminSecondFactorRoute';

export function meta(args: MetaArgs): MetaDescriptor[] {
  return appMeta(args, 'seo.admin.secondFactor.title');
}
