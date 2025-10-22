/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'gray-blue': '#2b323f',
                'milk-orange': '#EC5E27',
            }
        },
    },
    plugins: [],
}