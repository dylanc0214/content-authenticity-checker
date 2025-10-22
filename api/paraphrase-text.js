// api/paraphrase-text.js - Handles paraphrasing requests

export default async function handler(request, response) {
    // 1. Only allow POST requests
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 2. Get the text to paraphrase from the frontend request body
        const { textToParaphrase } = request.body;

        if (!textToParaphrase || typeof textToParaphrase !== 'string' || textToParaphrase.trim() === '') {
            return response.status(400).json({ error: 'Text to paraphrase is required' });
        }

        // 3. Get your secret API key
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY is not set');
            return response.status(500).json({ error: 'Server configuration error' });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        // --- System Prompt for Paraphrasing ---
        // This prompt instructs the AI to make the text sound human and less detectable
        const systemPrompt = `You are a sophisticated paraphrasing tool. Your goal is to rewrite the provided text to make it sound completely natural and human-written, significantly reducing the likelihood of it being flagged by AI detection tools.

Instructions:
- Retain the original meaning and core information.
- Vary sentence structures significantly. Avoid repetitive patterns.
- Use more natural vocabulary and phrasing. Replace overly formal or complex words with simpler, common alternatives where appropriate.
- Introduce slight variations in tone or style if it enhances naturalness, but stay true to the original intent.
- Ensure grammatical correctness and fluency.
- Critically important: Focus on eliminating patterns typical of AI-generated text (e.g., predictable transitions, overly enumerated lists, generic phrasing, excessive hedging). Aim for a style that would realistically be produced by a human.
- Do NOT add any commentary before or after the paraphrased text. Only output the paraphrased text itself.`;
        // --- End of System Prompt ---

        // Construct the payload for the Gemini API call
        const payload = {
            contents: [{ parts: [{ text: textToParaphrase }] }], // The user's text
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            // We expect plain text back, no JSON schema needed here
            generationConfig: {
                // Optional: Control temperature for creativity vs. faithfulness
                // temperature: 0.7,
                // maxOutputTokens: 2048, // Adjust if needed
            }
        };

        // 4. Call the Gemini API
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Handle potential errors from the Gemini API
        if (!geminiResponse.ok) {
            let errorBody;
            try { errorBody = await geminiResponse.json(); }
            catch (e) { errorBody = { error: await geminiResponse.text() }; } // Fallback if error body isn't JSON
            console.error('Gemini API Error (Paraphrase) Status:', geminiResponse.status);
            console.error('Gemini API Error (Paraphrase) Body:', errorBody);

            // Check for specific safety blocks
            if (errorBody?.promptFeedback?.blockReason) {
                return response.status(400).json({ error: `Paraphrasing blocked: ${errorBody.promptFeedback.blockReason}. Try modifying the text.` });
            }

            return response.status(500).json({ error: `AI paraphrasing service failed (Status: ${geminiResponse.status})` });
        }


        // If successful, extract the paraphrased text
        const result = await geminiResponse.json();

        // Ensure the response structure is valid and text exists
        const paraphrasedText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!paraphrasedText) {
            console.error('Unexpected response structure from Gemini (Paraphrase):', result);
            return response.status(500).json({ error: 'Failed to extract paraphrased text from AI response.' });
        }

        // 5. Send the paraphrased text back to the frontend
        return response.status(200).json({ paraphrasedText: paraphrasedText.trim() }); // Trim whitespace

    } catch (err) {
        // Catch any unexpected server errors
        console.error('Paraphrase API internal error:', err);
        return response.status(500).json({ error: 'Internal Server Error during paraphrasing.' });
    }
}
