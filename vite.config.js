import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/postcss' // <-- THIS IS THE FIX. Use @tailwindcss/postcss
import autoprefixer from 'autoprefixer' // <-- Import Autoprefixer

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    css: { // <-- ADD THIS SECTION
        postcss: {
            plugins: [
                tailwindcss,
                autoprefixer,
            ],
        },
    },
})