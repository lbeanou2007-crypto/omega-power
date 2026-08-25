import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Le front appelle "/api/..." et Vite redirige vers le backend Java.
    // Avantage : plus aucun probleme de CORS en developpement.
    proxy: {
      '/api': {
        target: ' http://192.168.100.197:8090',
        changeOrigin: true,
      },
    },
  },
})
