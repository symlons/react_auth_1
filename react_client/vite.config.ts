import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    proxy: {
      '/api': {
        target: 'https://localhost:443/',
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
});
