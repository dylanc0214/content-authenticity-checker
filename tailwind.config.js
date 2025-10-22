/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            // --- ADD THIS SECTION ---
            colors: {
                'gray-blue': '#2b323f',
                'milk': '#FDFDF1',
            }
            // --- END OF SECTION ---
        },
    },
    plugins: [],
}