import { data } from 'react-router';

export { NotFoundRoute as default } from '../app/NotFoundRoute';

// No route of this app answers here, and now that a server renders the page it says so: a crawler
// (or a monitor) must not read a mistyped address as a page that exists.
export function loader() {
  return data(null, { status: 404 });
}

// Inside the app the answer is already known; the server is not asked.
export function clientLoader() {
  return null;
}
