// This is your new secure backend function (api/check-ai.js)

export default async function handler(request, response) {
    // 1. Only allow POST requests
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 2. Get the text from the frontend's request
        const { text } = request.body;
        if (!text) {
            return response.status(400).json({ error: 'Text is required' });
        }

        // 3. Get your *secret* API key from Vercel's Environment Variables
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY is not set');
            return response.status(500).json({ error: 'API key not configured' });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        // --- THIS IS THE UPDATED PROMPT ---
        const systemPrompt = `You are an AI text detector. Analyze the following text and provide your assessment. Your response MUST be in the JSON format defined in the schema.
1.  Provide an \`aiScore\` (a number from 0-100)
2.  Provide a brief \`justification\` for the score.
3.  Most importantly: Identify the *exact sentences* from the user's text that are most likely AI-generated. Return these sentences in the \`aiSentences\` array. Only include sentences with high confidence of being AI. If no sentences are detected, return an empty array.`;

        // --- THIS IS THE UPDATED PAYLOAD & SCHEMA ---
        const payload = {
            contents: [{ parts: [{ text: text }] }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        "aiScore": {
                            "type": "NUMBER",
                            "description": "A percentage score from 0 (definitely human) to 100 (definitely AI)."
                        },
                        "justification": {
                            "type": "STRING",
                            "description": "A brief, one-sentence justification for the score."
                        },
                        "aiSentences": {
                            "type": "ARRAY",
                            "items": { "type": "STRING" },
                            "description": "An array of exact sentences from the input text that are most likely AI-generated."
                        }
                    },
                    required: ["aiScore", "justification", "aiSentences"]
                }
            }
        };

        // 4. Call the Gemini API *from the server*
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error('Gemini API Error:', errorText);
            return response.status(geminiResponse.status).json({ error: `Gemini API Error: ${errorText}` });
        }

        const result = await geminiResponse.json();

        // 5. Send the result *back* to your frontend
        return response.status(200).json(result);

    } catch (err) {
        console.error('Serverless function error:', err);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
