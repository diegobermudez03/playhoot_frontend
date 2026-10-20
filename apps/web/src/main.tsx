import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { router } from './app/router';
import { createServices, startServices } from './app/services';
import { ServicesProvider } from './app/ServicesContext';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

const services = createServices();
startServices(services);

createRoot(container).render(
  <StrictMode>
    <ServicesProvider services={services}>
      <RouterProvider router={router} />
    </ServicesProvider>
  </StrictMode>,
);
