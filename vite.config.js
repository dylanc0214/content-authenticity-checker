import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss' // Import tailwind
import autoprefixer from 'autoprefixer' // Import autoprefixer

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
