import { defineConfig } from 'vite';
import ReactPlugin from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [ReactPlugin()],
  server: {
    port: 3050,
    host: '0.0.0.0',
  },
});
