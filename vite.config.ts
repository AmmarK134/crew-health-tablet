import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The tablet interface talks to the team's Flask server (same endpoints as the original front end).
// In development, Vite forwards /api to that server. Change the address with CREW_API if needed.
const api = process.env.CREW_API || 'http://127.0.0.1:5000';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': api } },
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});
