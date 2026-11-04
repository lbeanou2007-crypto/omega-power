import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      // Port de l'IHM (ouvrir http://localhost:8443).
      port: 8443,
      // Le front appelle "/api/..." et Vite redirige vers l'API hebergee sur
      // Render (VITE_API_PROXY_TARGET dans .env).
      // Avantage : le navigateur ne parle qu'a Vite (meme origine), donc
      // aucun probleme de CORS.
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'https://batterie-connectee-api.onrender.com',
          changeOrigin: true,
          // Render presente un certificat reconnu : on le fait valider.
          secure: true,
          // Le navigateur ajoute "Origin: http://localhost:8443" sur les POST
          // et DELETE, et l'API repond 403 a cette origine. La requete vient
          // ici du serveur Vite : on retire donc cet en-tete avant l'envoi.
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
          },
        },
      },
    },
  }
})
