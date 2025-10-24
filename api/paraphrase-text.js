// api/paraphrase-text.js - Handles paraphrasing text with specific humanizing rules

export default async function handler(request, response) {
    // 1. Only allow POST requests
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 2. Get text and desired style from the frontend request body
        const { textToParaphrase, style } = request.body;

        if (!textToParaphrase || typeof textToParaphrase !== 'string' || textToParaphrase.trim() === '') {
            return response.status(400).json({ error: 'Text to paraphrase is required' });
        }

        const validStyles = ['default', 'formal', 'casual', 'simple'];
        const paraphraseStyle = validStyles.includes(style) ? style : 'default';

        // 3. Get Gemini API key
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY is not set');
            return response.status(500).json({ error: 'Paraphrasing service is not configured.' });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        // --- *** NEW DETAILED SYSTEM PROMPT *** ---
        let systemPrompt = `You are an expert paraphraser specializing in rewriting text to sound naturally human and avoid AI detection. Your primary goal is to reduce the likelihood of the text being flagged by AI detectors. Follow ALL these rules strictly:

1.  **Sentence Structure Variation:** Actively vary sentence structures. Combine short, simple sentences with longer compound and complex sentences. Use parenthetical phrases occasionally for natural flow. Avoid monotonous or overly predictable sentence patterns.
2.  **Natural Transitions:** Replace robotic or overly formal connectors (like "Firstly,", "Secondly,", "In conclusion,", "Subsequently,", "Moreover,", "Furthermore,") with simpler, more common, and natural transition words (like "Also,", "But,", "So,", "Then,", "Next," or rephrasing the sentence to connect implicitly). Ensure logical flow is maintained clearly but subtly.
3.  **Vocabulary:** Replace complex, technical, or esoteric vocabulary with more common, direct, and simpler words where possible, unless the technical term is essential for meaning. Aim for clarity and natural language.
4.  **Accuracy and Attribution:** The paraphrased text MUST remain factually accurate based ONLY on the provided input text. Do NOT add new information or fabricate details. If the input text is unclear or requires external knowledge you don't have, state that you cannot accurately paraphrase that part. Do not directly copy phrases; rephrase everything in your own words. (Assume any direct quotes needed were already handled according to APA format in the input).
5.  **Tone Adjustment (Based on Style):** Maintain a style between formal academic and natural oral description, adjusting based on the requested style:
    * **Formal:** Lean towards more structured sentences and precise vocabulary, but still adhere to rules 1-4.
    * **Casual:** Use more conversational phrasing and contractions, while adhering to rules 1-4.
    * **Simple:** Prioritize very clear, straightforward language and shorter sentences where appropriate, while adhering to rules 1-4.
    * **Default/Standard:** A balanced, neutral tone adhering strictly to rules 1-4.
6.  **Completeness & Conciseness:** Ensure every sentence has a clear subject and verb. Remove any concluding summary paragraph or sentences if they merely repeat earlier points without adding new insight. Focus on rewriting the core content.
7.  **Output Format:** Respond ONLY with the fully paraphrased text. Do NOT include any explanations, introductions, apologies, or comments about the process. Just the rewritten text.`;

        // Add specific style modification phrase to the prompt
        switch (paraphraseStyle) {
            case 'formal':
                systemPrompt += `\nApply a FORMAL tone adjustment.`;
                break;
            case 'casual':
                systemPrompt += `\nApply a CASUAL tone adjustment.`;
                break;
            case 'simple':
                systemPrompt += `\nApply a SIMPLE language adjustment.`;
                break;
            // Default: No specific style adjustment phrase needed
        }
        // --- *** END OF NEW PROMPT *** ---


        // Construct the payload for Gemini API
        const payload = {
            contents: [{
                parts: [{ text: `Paraphrase the following text according to the rules provided:\n\n${textToParaphrase}` }]
            }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            // Consider slightly higher temperature for more varied phrasing
            generationConfig: {
                temperature: 0.75, // Increased slightly
                maxOutputTokens: 8192,
            },
            // Stricter safety settings might be good here
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
            ]
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
            catch (e) { errorBody = { message: await geminiResponse.text() }; }

            if (errorBody?.promptFeedback?.blockReason) {
                console.warn(`Paraphrase request blocked due to safety settings: ${errorBody.promptFeedback.blockReason}`);
                return response.status(400).json({ error: `Paraphrasing blocked: ${errorBody.promptFeedback.blockReason}. Content may violate safety policies.` });
            }

            console.error('Gemini API Error Status (Paraphrase):', geminiResponse.status);
            console.error('Gemini API Error Body (Paraphrase):', errorBody);
            const errorMessage = errorBody?.error?.message || errorBody?.message || `Gemini API request failed (Status: ${geminiResponse.status})`;
            return response.status(500).json({ error: errorMessage });
        }

        const result = await geminiResponse.json();

        // Extract the paraphrased text, checking for safety blocks in the response too
        const candidate = result.candidates?.[0];
        if (!candidate) {
            // Check for promptFeedback block reason if no candidates exist
            if (result.promptFeedback?.blockReason) {
                console.warn(`Paraphrase request blocked (no candidate): ${result.promptFeedback.blockReason}`);
                return response.status(400).json({ error: `Paraphrasing blocked: ${result.promptFeedback.blockReason}.` });
            }
            console.error('Paraphrase API response missing candidates:', result);
            return response.status(500).json({ error: 'AI returned no paraphrase suggestion.' });
        }

        if (candidate.finishReason === 'SAFETY') {
            console.warn('Paraphrase blocked by safety settings after generation.');
            return response.status(400).json({ error: 'Paraphrasing blocked due to safety concerns after generation.' });
        }
        if (candidate.finishReason !== 'STOP') {
            console.warn(`Paraphrase generation finished unexpectedly: ${candidate.finishReason}`);
            // Potentially return partial result or error depending on the reason
        }

        const paraphrasedText = candidate.content?.parts?.[0]?.text;


        if (!paraphrasedText) {
            console.error('Paraphrase API response missing text content:', JSON.stringify(result, null, 2));
            return response.status(500).json({ error: 'Failed to extract paraphrased text from the AI response.' });
        }

        // 5. Send the result back to the frontend
        return response.status(200).json({ paraphrasedText: paraphrasedText.trim() });

    } catch (err) {
        console.error('Paraphrase API internal error:', err);
        return response.status(500).json({ error: 'Internal Server Error during paraphrasing.' });
    }
}