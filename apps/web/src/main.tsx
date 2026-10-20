import '@fontsource-variable/fredoka';
import '@fontsource-variable/nunito';
import './ui/tokens.css';
import './ui/motion.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { router } from './app/router';
import { createServices, startServices } from './app/services';
import { ServicesProvider } from './app/ServicesContext';
import { I18nProvider } from './i18n/I18nProvider';
import { SoundProvider } from './sound';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

const services = createServices();
startServices(services);

createRoot(container).render(
  <StrictMode>
    <ServicesProvider services={services}>
      <I18nProvider>
        <SoundProvider player={services.sound}>
          <RouterProvider router={router} />
        </SoundProvider>
      </I18nProvider>
    </ServicesProvider>
  </StrictMode>,
);
