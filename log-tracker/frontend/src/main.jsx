import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { getState } from './store/store.js';
import './styles/global.css';

// apply saved theme before first paint
document.documentElement.setAttribute('data-theme', getState().theme);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
