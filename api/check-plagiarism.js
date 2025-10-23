// api/check-plagiarism.js - Handles calls to an external plagiarism checker API

export default async function handler(request, response) {
    // 1. Only allow POST requests
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 2. Get the text to check from the frontend request body
        const { textToCheck } = request.body;

        if (!textToCheck || typeof textToCheck !== 'string' || textToCheck.trim() === '') {
            return response.status(400).json({ error: 'Text to check is required' });
        }

        // 3. Get your *secret* Plagiarism API key from Vercel Environment Variables
        // --- YOU MUST ADD THIS VARIABLE IN VERCEL SETTINGS ---
        const plagiarismApiKey = process.env.PLAGIARISM_API_KEY;
        if (!plagiarismApiKey) {
            console.error('PLAGIARISM_API_KEY is not set');
            // Return a user-friendly error, don't expose server details
            return response.status(500).json({ error: 'Plagiarism checker service is not configured.' });
        }

        // --- ADJUST THIS SECTION BASED ON YOUR CHOSEN API ---
        const PLAGIARISM_API_ENDPOINT = 'https://api.your-chosen-plagiarism-service.com/v1/check'; // <-- ADJUST THIS URL

        const apiHeaders = {
            'Content-Type': 'application/json',
            // --- Choose ONE Authorization method based on API docs ---
            'Authorization': `Bearer ${plagiarismApiKey}`, // <-- Common method (like Copyscape) OR
            // 'X-Api-Key': plagiarismApiKey,             // <-- Another common method OR
            // ... other methods as required by the API
        };

        const apiBody = JSON.stringify({
            text: textToCheck, // <-- Field name might be 'text', 'content', 'data', etc. ADJUST THIS
            // mode: 'deep',    // <-- Some APIs have options like speed/depth. ADJUST or REMOVE
            // language: 'en',  // <-- Some APIs allow language specification. ADJUST or REMOVE
        });
        // --- END OF ADJUSTMENT SECTION ---


        // 4. Call the External Plagiarism API
        console.log(`Calling Plagiarism API: ${PLAGIARISM_API_ENDPOINT}`); // Log for debugging
        const plagiarismResponse = await fetch(PLAGIARISM_API_ENDPOINT, {
            method: 'POST',
            headers: apiHeaders,
            body: apiBody
        });

        // Handle API errors
        if (!plagiarismResponse.ok) {
            let errorBody;
            try { errorBody = await plagiarismResponse.json(); }
            catch (e) { errorBody = { message: await plagiarismResponse.text() }; } // Fallback
            console.error('Plagiarism API Error Status:', plagiarismResponse.status);
            console.error('Plagiarism API Error Body:', errorBody);
            // Try to provide a somewhat specific error message
            const errorMessage = errorBody?.message || errorBody?.error || `Plagiarism API request failed (Status: ${plagiarismResponse.status})`;
            return response.status(500).json({ error: errorMessage });
        }

        // If successful, parse the result
        const resultData = await plagiarismResponse.json();
        console.log('Plagiarism API Success Response:', resultData); // Log for debugging

        // --- ADJUST THIS SECTION TO MATCH THE API'S RESPONSE FORMAT ---
        // Extract the score and sources based on the actual API response structure
        const plagiarismScore = resultData?.percent_matched || resultData?.score * 100 || 0; // <-- ADJUST THESE field names
        const sources = (resultData?.results || resultData?.sources || []).map(source => ({
            url: source.url || source.uri || '#', // <-- ADJUST THESE field names
            snippet: source.matched_text || source.snippet || 'No snippet available', // <-- ADJUST THESE
            matchPercent: source.percent || source.score * 100 || 0 // <-- ADJUST THESE
        })).slice(0, 5); // Limit to showing ~5 sources for brevity
        // --- END OF ADJUSTMENT SECTION ---


        // 5. Send the formatted result back to the frontend
        return response.status(200).json({
            plagiarismScore: plagiarismScore,
            sources: sources
        });

    } catch (err) {
        // Catch any unexpected server errors
        console.error('Plagiarism Check API internal error:', err);
        return response.status(500).json({ error: 'Internal Server Error during plagiarism check.' });
    }
}
