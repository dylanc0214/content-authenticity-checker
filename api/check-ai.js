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

        const systemPrompt = "You are an AI text detector. Analyze the following text and provide your assessment. Your response MUST be in the JSON format defined in the schema. Provide a score from 0 (very likely human) to 100 (very likely AI-generated) and a brief justification.";

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
                        "aiScore": { "type": "NUMBER" },
                        "justification": { "type": "STRING" }
                    },
                    required: ["aiScore", "justification"]
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