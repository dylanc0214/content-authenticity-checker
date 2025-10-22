import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    // We don't need the 'css: {}' part here
    // because postcss.config.js is handling it now.
})

