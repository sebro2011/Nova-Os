import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PreferencesProvider } from './context/PreferencesContext';
import { NotificationProvider } from './context/NotificationContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreferencesProvider>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </PreferencesProvider>
  </React.StrictMode>,
);
