import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PreferencesProvider } from './context/PreferencesContext';
import { NotificationProvider } from './context/NotificationContext';
import { LocalizationProvider } from './context/LocalizationContext';
import './index.css';
import './styles/neon.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreferencesProvider>
      <LocalizationProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </LocalizationProvider>
    </PreferencesProvider>
  </React.StrictMode>,
);
