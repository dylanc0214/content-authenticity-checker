import React, { useState, useRef } from 'react';

// --- Constants ---
const AI_DETECTOR_TAB = 'ai';
const PARAPHRASE_CHECKER_TAB = 'paraphrase';

// --- Main App Component ---
export default function App() {
    const [activeTab, setActiveTab] = useState(AI_DETECTOR_TAB);
    const [inputText, setInputText] = useState(''); // Tracks initial textarea input
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [aiResult, setAiResult] = useState(null);
    const [paraphraseResult, setParaphraseResult] = useState(null);
    const inputRef = useRef(null); // Ref for textarea or div
    const [highlightedContent, setHighlightedContent] = useState(''); // HTML for the div

    // --- API Call: AI Detector ---
    // The backend now handles the prompt/schema details
    const callGeminiApi = async (text, retries = 3, delay = 1000) => {
        // Frontend just sends the text in the expected payload structure
        const payload = {
            contents: [{ parts: [{ text: text }] }]
            // System prompt and schema are now defined ONLY in the backend api/check-ai.js
        };

        try {
            // Backend URL remains the same
            const response = await fetch('/api/check-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload) // Send the simplified payload
            });

            if (!response.ok) {
                // Try to parse error JSON, fallback to text
                let errorBody;
                try { errorBody = await response.json(); }
                catch (e) { errorBody = { error: await response.text() }; }
                throw new Error(errorBody.error || `API Error: ${response.status}`);
            }
            const result = await response.json();

            // Check the structure of the *actual* response from the backend
            if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
                // The text part contains the JSON string we need to parse
                const jsonText = result.candidates[0].content.parts[0].text;
                try {
                    return JSON.parse(jsonText); // Parse the JSON string
                } catch(parseError) {
                    console.error("Failed to parse JSON response from backend:", jsonText, parseError);
                    throw new Error("Received malformed data from AI detector.");
                }
            } else {
                // Handle cases where the structure is not as expected
                console.error("Unexpected API response structure from backend:", result);
                // Provide a more specific error if possible
                let errorMsg = "Invalid response from AI detector.";
                if (result.promptFeedback?.blockReason) {
                    errorMsg = `Request blocked: ${result.promptFeedback.blockReason}`;
                } else if (!result.candidates || result.candidates.length === 0) {
                    errorMsg = "AI detector did not provide a response candidate.";
                }
                throw new Error(errorMsg);
            }
        } catch (err) {
            // Keep existing retry logic
            if (retries > 0 && err.message.includes("429")) { // Basic rate limit check
                await new Promise(res => setTimeout(res, delay));
                return callGeminiApi(text, retries - 1, delay * 2);
            } else {
                console.error("AI Detector API Error:", err); // Log the actual error
                throw err; // Re-throw the error
            }
        }
    };

    // --- API Call: Paraphrase Checker (SIMULATED - unchanged) ---
    const simulateParaphraseCheck = (text) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    plagiarismScore: Math.floor(Math.random() * 25) + 5,
                    sources: [{ url: 'https://www.simulated-source-one.com/article/example', snippet: '...this part of the text seems very similar...', matchPercent: 12 }, { url: 'https://www.fake-journal-entry.org/page/2', snippet: '...potential match for the phrase...', matchPercent: 8 }]
                });
            }, 1500);
        });
    };

    // --- Helper to escape Regex characters ---
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // --- Updated Highlighting Function ---
    const generateHighlightedHtml = (originalText, highConfidence = [], mediumConfidence = []) => {
        let highlightedText = originalText;
        // Sanitize basic HTML entities FIRST
        highlightedText = highlightedText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Replace newlines AFTER sanitizing, BEFORE highlighting
        highlightedText = highlightedText.replace(/\n/g, '<br />');

        // Make sure inputs are arrays, even if API returns null/undefined
        const highSentences = Array.isArray(highConfidence) ? highConfidence : [];
        const mediumSentences = Array.isArray(mediumConfidence) ? mediumConfidence : [];

        // Apply HIGH confidence highlights first (White)
        if (highSentences.length > 0) {
            highSentences.forEach(sentence => {
                // Sanitize sentence before using in regex
                const sanitizedSentence = sentence.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                try {
                    // Use try-catch for regex creation in case of complex/invalid sentences
                    const regex = new RegExp(escapeRegExp(sanitizedSentence), 'g');
                    highlightedText = highlightedText.replace(regex, `<mark class="ai-highlight-high">$&</mark>`);
                } catch (e) {
                    console.error("Regex error for high sentence:", sentence, e);
                    // Skip highlighting this sentence if regex fails
                }
            });
        }

        // Apply MEDIUM confidence highlights second (Grey)
        // Avoid highlighting text already marked as high confidence.
        if (mediumSentences.length > 0) {
            let processedText = '';
            // Split text by high highlights to avoid double-highlighting
            const segments = highlightedText.split(/(<mark class="ai-highlight-high">.*?<\/mark>)/);

            segments.forEach((segment) => {
                // Only process segments that are NOT already high highlights
                if (!segment.startsWith('<mark class="ai-highlight-high">')) {
                    let currentSegment = segment;
                    mediumSentences.forEach(sentence => {
                        const sanitizedSentence = sentence.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        try {
                            const regex = new RegExp(escapeRegExp(sanitizedSentence), 'g');
                            currentSegment = currentSegment.replace(regex, `<mark class="ai-highlight-medium">$&</mark>`);
                        } catch (e) {
                            console.error("Regex error for medium sentence:", sentence, e);
                        }
                    });
                    processedText += currentSegment; // Add processed segment
                } else {
                    processedText += segment; // Add back the high highlight untouched
                }
            });
            highlightedText = processedText; // Update the final text
        }

        return highlightedText;
    };


    // --- Event Handlers ---
    const handleSubmit = async () => {
        // Get text consistently from the ref, whether it's textarea or div
        const currentText = inputRef.current ? (inputRef.current.tagName === 'TEXTAREA' ? inputRef.current.value : inputRef.current.innerText) : '';
        if (!currentText.trim()) {
            setError("Please enter some text to check.");
            setHighlightedContent(generateHighlightedHtml('', [], [])); // Clear highlights
            return;
        }

        setIsLoading(true);
        setError(null);
        setAiResult(null);
        setParaphraseResult(null);
        // Show plain text (HTML formatted) while loading
        setHighlightedContent(generateHighlightedHtml(currentText, [], []));

        try {
            if (activeTab === AI_DETECTOR_TAB) {
                const result = await callGeminiApi(currentText);
                setAiResult(result);
                // Generate HTML with new gradient highlighting, ensure arrays exist
                const html = generateHighlightedHtml(
                    currentText,
                    result.highConfidenceSentences || [],
                    result.mediumConfidenceSentences || []
                );
                setHighlightedContent(html);
            } else if (activeTab === PARAPHRASE_CHECKER_TAB) {
                const result = await simulateParaphraseCheck(currentText);
                setParaphraseResult(result);
                const html = generateHighlightedHtml(currentText, [], []); // No highlights for paraphrase
                setHighlightedContent(html);
            }
        } catch (err) {
            setError(`Failed to get result: ${err.message}. Please try again.`);
            const html = generateHighlightedHtml(currentText, [], []); // Show plain text on error
            setHighlightedContent(html);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setAiResult(null);
        setParaphraseResult(null);
        setError(null);
        setIsLoading(false);
        // Reset highlights to plain text when switching tabs
        const currentText = inputRef.current ? (inputRef.current.tagName === 'TEXTAREA' ? inputRef.current.value : inputRef.current.innerText) : inputText;
        setHighlightedContent(generateHighlightedHtml(currentText, [], []));
    };

    const hasResult = aiResult || paraphraseResult;

    // --- Render ---
    return (
        <div className="flex justify-center items-start min-h-screen bg-gray-900 font-sans p-4 pt-10">
            <div className={`w-full ${hasResult ? 'max-w-6xl' : 'max-w-2xl'} bg-gray-blue rounded-xl shadow-2xl overflow-hidden my-8 transition-all duration-500 ease-in-out`}>
                {/* Header and Tabs */}
                <header className="p-6">
                    <h1 className="text-3xl font-bold text-white text-center">Content Authenticity Checker</h1>
                    <p className="text-gray-400 text-center mt-1">Check for AI generation and paraphrase percentage.</p>
                </header>
                <nav className="flex bg-gray-blue/50 border-b border-gray-700">
                    <TabButton title="AI Detector" isActive={activeTab === AI_DETECTOR_TAB} onClick={() => handleTabChange(AI_DETECTOR_TAB)} />
                    <TabButton title="Paraphrase Checker" isActive={activeTab === PARAPHRASE_CHECKER_TAB} onClick={() => handleTabChange(PARAPHRASE_CHECKER_TAB)} />
                </nav>

                {/* --- Main Content Grid --- */}
                <div className={`grid ${hasResult ? 'grid-cols-1 md:grid-cols-2 gap-x-8' : 'grid-cols-1'} transition-all duration-500 ease-in-out`}>

                    {/* --- Column 1: Text Input Area --- */}
                    <div className="p-6 md:p-8 flex flex-col">
                        {/* Input Div/Textarea */}
                        {hasResult ? (
                            <div
                                ref={inputRef}
                                className="w-full h-96 p-4 border border-gray-700 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-milk overflow-y-auto flex-grow prose prose-invert max-w-none prose-mark:p-0 prose-mark:rounded-none prose-mark:bg-opacity-100" // Tailwind prose for better text formatting, reset mark padding/radius
                                dangerouslySetInnerHTML={{ __html: highlightedContent }}
                                contentEditable={false} // Make it non-editable after analysis
                                suppressContentEditableWarning={true}
                            />
                        ) : (
                            <textarea
                                ref={inputRef}
                                className="w-full h-96 p-4 border border-gray-700 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-milk resize-none placeholder-gray-500 flex-grow"
                                placeholder="Paste text here to check..."
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                disabled={isLoading}
                            />
                        )}

                        {/* Highlight Legend (only for AI tab when results exist) */}
                        {activeTab === AI_DETECTOR_TAB && hasResult && aiResult && (
                            <HighlightLegend />
                        )}

                        {/* Analyze Button and Error Message */}
                        <button
                            onClick={handleSubmit}
                            disabled={isLoading}
                            className="w-full mt-4 p-4 bg-milk text-gray-blue font-semibold rounded-lg shadow-md hover:bg-opacity-90 transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex justify-center items-center"
                        >
                            {isLoading ? <Spinner /> : 'Analyze Text'}
                        </button>
                        {error && (
                            <div className="mt-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-lg text-sm"> {/* Smaller error text */}
                                {error}
                            </div>
                        )}
                    </div>

                    {/* --- Column 2: Results Area --- */}
                    {hasResult && (
                        <div className="p-6 md:p-8 border-t md:border-t-0 md:border-l border-gray-700">
                            {isLoading && <div className="text-center text-gray-400 h-full flex items-center justify-center">Checking...</div>}
                            {!isLoading && activeTab === AI_DETECTOR_TAB && aiResult && <AiResultDisplay result={aiResult} />}
                            {!isLoading && activeTab === PARAPHRASE_CHECKER_TAB && paraphraseResult && <ParaphraseResultDisplay result={paraphraseResult} />}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Helper Components ---

// Highlight Legend Component
function HighlightLegend() {
    return (
        <div className="mt-3 text-xs text-gray-400 highlight-legend flex items-center space-x-4">
            <span>Key:</span>
            <div className="flex items-center">
                <span style={{ backgroundColor: '#FFFFFF', color: '#2b323f', padding: '1px 4px', borderRadius: '3px', marginRight: '5px', fontWeight: '500' }}>White</span> - High Confidence AI
            </div>
            <div className="flex items-center">
                <span style={{ backgroundColor: '#4b5563', color: '#FDFDF1', padding: '1px 4px', borderRadius: '3px', marginRight: '5px' }}>Grey</span> - Medium Confidence AI
            </div>
        </div>
    );
}


// TabButton and Spinner remain the same
function TabButton({ title, isActive, onClick }) { return (<button onClick={onClick} className={`flex-1 py-4 px-2 font-medium text-center transition-all duration-200 outline-none ${ isActive ? 'border-b-4 border-milk text-milk' : 'text-gray-400 hover:bg-gray-700/30 hover:text-gray-200'}`}>{title}</button>); }
function Spinner() { return (<svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>); }

// AiResultDisplay remains the same (displays score, justification)
function AiResultDisplay({ result }) {
    const score = result ? Math.round(result.aiScore) : 0;
    const color = score > 75 ? 'text-red-400' : score > 40 ? 'text-yellow-400' : 'text-green-400';
    const confidence = score > 75 ? 'High Confidence' : score > 40 ? 'Medium Confidence' : 'Low Confidence';
    // Check both arrays now
    const sentencesDetected = result && ( (Array.isArray(result.highConfidenceSentences) && result.highConfidenceSentences.length > 0) || (Array.isArray(result.mediumConfidenceSentences) && result.mediumConfidenceSentences.length > 0) );

    return (
        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 animate-fade-in h-full flex flex-col">
            <h3 className="text-xl font-semibold text-white mb-4 text-center">AI Detection Result</h3>
            <div className="flex items-center justify-center space-x-4 mb-4">
                <div className={`text-6xl font-bold ${color}`}>{score}%</div>
                <div className="text-lg text-center">
                    <div className="font-semibold text-gray-200">Likely AI-Generated</div>
                    <div className={`text-sm ${color}`}>{confidence}</div>
                </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden mb-4">
                <div className={`h-4 rounded-full transition-all duration-500 ease-in-out ${ score > 75 ? 'bg-red-500' : score > 40 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${score}%` }}></div>
            </div>
            <div>
                <h4 className="font-semibold text-gray-200">Justification:</h4>
                <p className="text-gray-400 italic text-sm">"{result?.justification || 'N/A'}"</p> {/* Smaller justification */}
            </div>
            <div className="mt-4 text-sm text-gray-500 text-center flex-grow flex items-end justify-center">
                {sentencesDetected ? 'Highlighted sentences shown in the text input area (see key below input).' : 'No specific AI sentences detected with high/medium confidence.'}
            </div>
        </div>
    );
}

// ParaphraseResultDisplay remains the same
function ParaphraseResultDisplay({ result }) {
    const score = result ? Math.round(result.plagiarismScore) : 0;
    const color = score > 15 ? 'text-red-400' : score > 5 ? 'text-yellow-400' : 'text-green-400';
    const matchLevel = score > 15 ? 'High Match' : score > 5 ? 'Possible Match' : 'Likely Original';
    return (
        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 animate-fade-in h-full flex flex-col">
            <div className="bg-yellow-900/50 border-l-4 border-yellow-500 text-yellow-300 p-4 rounded-md mb-4">
                <h4 className="font-bold">Simulation Mode</h4>
                <p className="text-sm">This is simulated. Integrate a real plagiarism API for accurate checks.</p>
            </div>
            <h3 className="text-xl font-semibold text-white mb-4 text-center">Paraphrase Check Result</h3>
            <div className="flex items-center justify-center space-x-4 mb-4">
                <div className={`text-6xl font-bold ${color}`}>{score}%</div>
                <div className="text-lg text-center">
                    <div className="font-semibold text-gray-200">Potential Plagiarism</div>
                    <div className={`text-sm ${color}`}>{matchLevel}</div>
                </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden mb-4">
                <div className={`h-4 rounded-full transition-all duration-500 ease-in-out ${ score > 15 ? 'bg-red-500' : score > 5 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${score}%` }}></div>
            </div>
            <div className="mt-6 flex-grow overflow-y-auto"> {/* Allow scrolling */}
                <h4 className="font-semibold text-gray-200 mb-2">Simulated Matched Sources:</h4>
                {result?.sources && result.sources.length > 0 ? (
                    <ul className="space-y-3">{result.sources.map((source, index) => (<li key={index} className="border border-gray-700 p-3 rounded-lg bg-gray-800"><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-milk hover:underline font-medium block truncate text-sm">{source.url}</a><p className="text-gray-400 text-xs mt-1 italic">"{source.snippet}"</p><span className="text-xs font-semibold bg-red-800/50 text-red-300 px-2 py-0.5 rounded-full mt-2 inline-block">{source.matchPercent}% Match</span></li>))}</ul>) : (<p className="text-gray-500 text-sm italic">No simulated sources found.</p>)}</div></div>);
}

