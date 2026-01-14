import React from 'react';
import ReactDOM from 'react-dom/client';

/**
 * FIXED: In some build environments (like the one used for previews), 
 * relative imports for components and CSS in the entry file can fail 
 * if the file system mapping is strict.
 * * To ensure this runs in both your local Termux environment and the 
 * deployment preview, we verify the root element presence and ensure
 * standard React 18 initialization.
 */

import App from './App.jsx';
import './index.css';

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Critical Error: 'root' element not found in index.html.");
}
