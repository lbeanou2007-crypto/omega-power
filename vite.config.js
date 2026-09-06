import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // 5174 et non 5173 : l'ancien projet garde 5173, on peut donc lancer
    // les deux en meme temps et comparer les deux IHM cote a cote.
    port: 5174,
    // Le front appelle "/api/..." et Vite redirige vers le backend Java.
    // Avantage : plus aucun probleme de CORS en developpement.
    proxy: {
      '/api': {
        target: 'http://192.168.100.197:8090',
        changeOrigin: true,
      },
    },
  },
})
