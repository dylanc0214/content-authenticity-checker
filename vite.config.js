import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss' // <-- THIS IS CORRECT FOR V4

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    css: {
        postcss: {
            plugins: [
                tailwindcss,
                // We don't need autoprefixer, v4 does it automatically
            ],
        },
    },
})
