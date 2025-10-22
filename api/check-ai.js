// This is your new secure backend function (api/check-ai.js)

export default async function handler(request, response) {
    // 1. Only allow POST requests
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 2. Get the *payload* from the frontend's request
        // It's no longer just { text }, it's the full Gemini payload
        const payload = request.body;

        if (!payload || !payload.contents) {
            // Basic check if payload looks like a Gemini request
            return response.status(400).json({ error: 'Invalid request payload' });
        }

        // 3. Get your *secret* API key from Vercel's Environment Variables
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY is not set');
            // Don't reveal API key issues to the frontend
            return response.status(500).json({ error: 'Server configuration error' });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        // 4. Call the Gemini API *from the server*
        // We just forward the payload received from the frontend
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) // Forward the entire payload
        });

        // Handle potential errors from the Gemini API
        if (!geminiResponse.ok) {
            let errorBody;
            try {
                errorBody = await geminiResponse.json(); // Try to parse JSON error
            } catch (e) {
                errorBody = await geminiResponse.text(); // Fallback to text error
            }
            console.error('Gemini API Error Status:', geminiResponse.status);
            console.error('Gemini API Error Body:', errorBody);
            // Send a generic error back to the frontend
            return response.status(500).json({ error: `AI service failed (Status: ${geminiResponse.status})` });
        }

        // If Gemini API call was successful, get the JSON result
        const result = await geminiResponse.json();

        // 5. Send the successful result *back* to your frontend
        return response.status(200).json(result);

    } catch (err) {
        // Catch any unexpected errors during the process
        console.error('Serverless function internal error:', err);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}

