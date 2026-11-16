import type { MetaArgs, MetaDescriptor } from 'react-router';

import { appMeta } from '../seo/meta';

export { AdminBudgetRoute as default } from '../features/admin/AdminBudgetRoute';

export function meta(args: MetaArgs): MetaDescriptor[] {
  return appMeta(args, 'seo.admin.budget.title');
}
