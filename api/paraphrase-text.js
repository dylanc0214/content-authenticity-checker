// api/paraphrase-text.js - Handles paraphrasing text with different styles

export default async function handler(request, response) {
    // 1. Only allow POST requests
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 2. Get text and desired style from the frontend request body
        const { textToParaphrase, style } = request.body; // Added 'style'

        if (!textToParaphrase || typeof textToParaphrase !== 'string' || textToParaphrase.trim() === '') {
            return response.status(400).json({ error: 'Text to paraphrase is required' });
        }

        // Validate the style (optional but good practice)
        const validStyles = ['default', 'formal', 'casual', 'simple'];
        const paraphraseStyle = validStyles.includes(style) ? style : 'default'; // Default if invalid style received

        // 3. Get your *secret* Gemini API key from Venvtel Environment Variables
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY is not set');
            return response.status(500).json({ error: 'Paraphrasing service is not configured.' });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        // --- UPDATED Prompt based on style ---
        let systemPrompt = `You are a helpful assistant that paraphrases text. Your goal is to make the text sound more human-written and less like AI, aiming to bypass AI detectors if possible, while preserving the original meaning. Respond ONLY with the paraphrased text, no extra explanations or introductions.`;

        switch (paraphraseStyle) {
            case 'formal':
                systemPrompt += ` Adopt a formal and professional tone.`;
                break;
            case 'casual':
                systemPrompt += ` Adopt a casual and conversational tone.`;
                break;
            case 'simple':
                systemPrompt += ` Simplify the language and sentence structure for easier understanding.`;
                break;
            // Default: No specific style instruction added, relies on the base prompt
        }
        // --- END UPDATE ---


        // Construct the payload for Gemini API
        const payload = {
            contents: [{
                parts: [{ text: `Paraphrase the following text: ${textToParaphrase}` }] // Simple instruction
            }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            // Safety settings might be needed if paraphrasing sensitive content
            // safetySettings: [ ... ],
            generationConfig: {
                // Adjust temperature for more creative/varied paraphrasing if needed
                // temperature: 0.7,
                maxOutputTokens: 8192, // Allow for potentially longer paraphrased text
            }
        };

        // 4. Call the Gemini API
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Handle API errors
        if (!geminiResponse.ok) {
            let errorBody;
            try { errorBody = await geminiResponse.json(); }
            catch (e) { errorBody = { message: await geminiResponse.text() }; } // Fallback

            // Check for specific safety block
            if (errorBody?.promptFeedback?.blockReason) {
                console.warn(`Paraphrase request blocked due to safety settings: ${errorBody.promptFeedback.blockReason}`);
                return response.status(400).json({ error: `Paraphrasing blocked: ${errorBody.promptFeedback.blockReason}. Try revising the input text.` });
            }

            console.error('Gemini API Error Status (Paraphrase):', geminiResponse.status);
            console.error('Gemini API Error Body (Paraphrase):', errorBody);
            const errorMessage = errorBody?.error?.message || errorBody?.message || `Gemini API request failed (Status: ${geminiResponse.status})`;
            return response.status(500).json({ error: errorMessage });
        }


        const result = await geminiResponse.json();

        // Extract the paraphrased text
        const paraphrasedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!paraphrasedText) {
            console.error('Paraphrase API response missing text:', result);
            // Check if response was blocked after success status (rare but possible)
            if (result.candidates?.[0]?.finishReason === 'SAFETY') {
                return response.status(400).json({ error: 'Paraphrasing blocked due to safety concerns after generation.' });
            }
            return response.status(500).json({ error: 'Failed to get paraphrased text from the AI.' });
        }

        // 5. Send the result back to the frontend
        return response.status(200).json({ paraphrasedText: paraphrasedText.trim() });

    } catch (err) {
        // Catch any unexpected server errors
        console.error('Paraphrase API internal error:', err);
        return response.status(500).json({ error: 'Internal Server Error during paraphrasing.' });
    }
}

