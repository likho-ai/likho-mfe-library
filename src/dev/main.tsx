/**
 * Runs this app on its own during development, with the real API behind the local gateway.
 * In the product the shell loads ./App; this page is never served there.
 */
import { LikhoProvider } from '@likho-ai/web-sdk';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import App from '../App';
import './dev.css';

const apiOrigin = import.meta.env.VITE_API_ORIGIN || window.location.origin;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LikhoProvider baseUrl={apiOrigin}>
      <BrowserRouter basename="/mfe/library">
        <main className="mx-auto max-w-[1240px] px-6 py-8">
          <Routes>
            <Route path="/*" element={<App />} />
            <Route path="/recordings/:id" element={<App />} />
          </Routes>
        </main>
      </BrowserRouter>
    </LikhoProvider>
  </StrictMode>,
);
