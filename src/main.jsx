import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Si la URL se quedó en /login de la versión antigua, la devuelve a la raíz /
if (window.location.pathname === '/login') {
  window.history.replaceState({}, document.title, '/');
}

// Limpiar claves antiguas para que muestre la pantalla de Login de entrada
localStorage.removeItem('rch_user');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)