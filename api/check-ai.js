// api/check-ai.js - Updated for confidence levels

export default async function handler(request, response) {
    // 1. Only allow POST requests
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 2. Get the *payload* from the frontend's request
        // The frontend now sends the Gemini payload structure directly
        const payloadFromFrontend = request.body;

        if (!payloadFromFrontend || !payloadFromFrontend.contents) {
            return response.status(400).json({ error: 'Invalid request payload' });
        }

        // --- NEW SYSTEM PROMPT & SCHEMA ---
        const systemPrompt = `You are an AI text detector. Analyze the following text and provide your assessment. Your response MUST be in the JSON format defined in the schema.
1.  Provide an \`aiScore\` (a number from 0-100).
2.  Provide a brief \`justification\` for the score.
3.  Identify the *exact sentences* most likely AI-generated with **HIGH** confidence. Put these in the \`highConfidenceSentences\` array.
4.  Identify the *exact sentences* likely AI-generated with **MEDIUM** confidence. Put these in the \`mediumConfidenceSentences\` array.
5.  If no sentences meet a confidence level, return an empty array for that level. Ensure sentences are exact matches from the input text.`;

        const responseSchema = {
            type: "OBJECT",
            properties: {
                "aiScore": {
                    "type": "NUMBER",
                    "description": "A percentage score from 0 (definitely human) to 100 (definitely AI)."
                },
                "justification": {
                    "type": "STRING",
                    "description": "A brief justification for the score."
                },
                "highConfidenceSentences": {
                    "type": "ARRAY",
                    "items": { "type": "STRING" },
                    "description": "Array of exact sentences detected with HIGH confidence as AI-generated."
                },
                "mediumConfidenceSentences": {
                    "type": "ARRAY",
                    "items": { "type": "STRING" },
                    "description": "Array of exact sentences detected with MEDIUM confidence as AI-generated."
                }
            },
            required: ["aiScore", "justification", "highConfidenceSentences", "mediumConfidenceSentences"]
        };
        // --- END OF NEW PROMPT & SCHEMA ---


        // Construct the final payload for Gemini, incorporating the new schema
        const finalPayload = {
            contents: payloadFromFrontend.contents, // Use content from frontend request
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: responseSchema // Use the new schema
            }
        };


        // 3. Get your *secret* API key from Vercel's Environment Variables
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY is not set');
            return response.status(500).json({ error: 'Server configuration error' });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        // 4. Call the Gemini API *from the server*
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalPayload) // Send the final payload with updated schema
        });

        // Handle potential errors from the Gemini API
        if (!geminiResponse.ok) {
            let errorBody;
            try { errorBody = await geminiResponse.json(); }
            catch (e) { errorBody = await geminiResponse.text(); }
            console.error('Gemini API Error Status:', geminiResponse.status);
            console.error('Gemini API Error Body:', errorBody);
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

