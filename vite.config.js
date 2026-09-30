import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      // Port de l'IHM (ouvrir http://localhost:8443). Ancien port de l'API du
      // camarade, qui est passee sur 9443 : aucun conflit, meme si les deux
      // tournent sur la meme machine.
      port: 8443,
      // Le front appelle "/api/..." et Vite redirige vers l'API du camarade,
      // lancee sur SA machine du reseau local (VITE_API_PROXY_TARGET dans
      // .env, ex: https://192.168.100.197:9443 - port HTTPS actuel
      // de l'API du camarade (8443 avant le 30/09/2026)).
      // Avantage : le navigateur ne parle qu'a Vite (meme origine), donc
      // aucun probleme de CORS ni de certificat auto-signe a accepter.
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'https://192.168.100.197:9443',
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
