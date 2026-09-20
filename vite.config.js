import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      // 5174 et non 5173 : l'ancien projet garde 5173, on peut donc lancer
      // les deux en meme temps et comparer les deux IHM cote a cote.
      port: 5174,
      // Le front appelle "/api/..." et Vite redirige vers l'API du camarade,
      // lancee sur SA machine du reseau local (VITE_API_PROXY_TARGET dans
      // .env, ex: https://192.168.100.197:8443 - port 8443 = server.port
      // dans application.properties de l'API, pas 9443).
      // Avantage : le navigateur ne parle qu'a Vite (meme origine), donc
      // aucun probleme de CORS ni de certificat auto-signe a accepter.
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'https://192.168.100.197:8443',
          changeOrigin: true,
          // Certificat auto-signe (keystore.p12) cote API : Vite doit
          // l'accepter sans le valider, sinon le proxy renvoie une erreur
          // "self signed certificate".
          secure: false,
        },
      },
    },
  }
})
