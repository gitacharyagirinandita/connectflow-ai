import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build` makes ONE file (dist/index.html) that opens with a double-click.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
})
