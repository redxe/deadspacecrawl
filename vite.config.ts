import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.local-tools/**'] },
  },
})
