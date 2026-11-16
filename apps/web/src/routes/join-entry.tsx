import type { MetaArgs, MetaDescriptor } from 'react-router';

import { publicMeta } from '../seo/meta';

export { EnterCodeRoute as default } from '../features/session-join/EnterCodeRoute';

export function meta(args: MetaArgs): MetaDescriptor[] {
  return publicMeta(args, {
    path: '/join',
    titleId: 'seo.join.title',
    descriptionId: 'seo.join.description',
  });
}
