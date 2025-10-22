import React, { useState, useRef } from 'react'; // Removed useEffect as it wasn't used directly

// --- Constants ---
const AI_DETECTOR_TAB = 'ai';
const PARAPHRASE_CHECKER_TAB = 'paraphrase';

// --- Main App Component ---
export default function App() {
    const [activeTab, setActiveTab] = useState(AI_DETECTOR_TAB);
    // inputText state is mainly for the initial render of the textarea
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // State for results
    const [aiResult, setAiResult] = useState(null);
    const [paraphraseResult, setParaphraseResult] = useState(null);

    // This ref will hold the editable div OR the textarea
    const inputRef = useRef(null);

    // A new state to hold the HTML content for the div
    const [highlightedContent, setHighlightedContent] = useState('');

    // --- API Call: AI Detector (REAL & SECURE) ---
    const callGeminiApi = async (text, retries = 3, delay = 1000) => {
        const systemPrompt = `You are an AI text detector. Analyze the following text and provide your assessment. Your response MUST be in the JSON format defined in the schema.
1.  Provide an \`aiScore\` (a number from 0-100)
2.  Provide a brief \`justification\` for the score.
3.  Most importantly: Identify the *exact sentences* from the user's text that are most likely AI-generated. Return these sentences in the \`aiSentences\` array. Only include sentences with high confidence of being AI. If no sentences are detected, return an empty array.`;

        const payload = {
            contents: [{ parts: [{ text: text }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        "aiScore": { "type": "NUMBER" },
                        "justification": { "type": "STRING" },
                        "aiSentences": { "type": "ARRAY", "items": { "type": "STRING" } }
                    },
                    required: ["aiScore", "justification", "aiSentences"]
                }
            }
        };

        try {
            const response = await fetch('/api/check-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `API Error: ${response.status}`);
            }
            const result = await response.json();
            if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
                return JSON.parse(result.candidates[0].content.parts[0].text);
            } else {
                console.error("Unexpected API response structure:", result);
                throw new Error("Invalid response from AI detector.");
            }
        } catch (err) {
            if (retries > 0 && err.message.includes("429")) { // Basic rate limit check
                await new Promise(res => setTimeout(res, delay));
                return callGeminiApi(text, retries - 1, delay * 2);
            } else {
                console.error("AI Detector API Error:", err); // Log the actual error
                throw err; // Re-throw the error
            }
        }
    };

    // --- API Call: Paraphrase Checker (SIMULATED) ---
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

    // --- This helper function is needed to safely highlight text ---
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // --- NEW: Function to generate and set highlighted HTML ---
    const generateHighlightedHtml = (originalText, sentencesToHighlight = []) => {
        let highlightedText = originalText;
        // Sanitize text for security before injecting as HTML
        highlightedText = highlightedText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        // Replace newlines for proper HTML rendering BEFORE highlighting
        highlightedText = highlightedText.replace(/\n/g, '<br />');

        // Ensure sentencesToHighlight is always an array
        const sentences = Array.isArray(sentencesToHighlight) ? sentencesToHighlight : [];

        if (sentences.length > 0) {
            sentences.forEach(sentence => {
                // Also sanitize the sentence fragments before creating regex
                const sanitizedSentence = sentence
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");

                // Escape regex special characters
                const regex = new RegExp(escapeRegExp(sanitizedSentence), 'g');
                highlightedText = highlightedText.replace(regex, `<mark>$&</mark>`);
            });
        }
        return highlightedText;
    };


    // --- Event Handlers ---
    const handleSubmit = async () => {
        // Get text from the correct element (div or textarea)
        const currentText = inputRef.current ? (inputRef.current.tagName === 'TEXTAREA' ? inputRef.current.value : inputRef.current.innerText) : '';

        if (!currentText.trim()) {
            setError("Please enter some text to check.");
            // Ensure highlighted content is cleared if input is empty
            setHighlightedContent(generateHighlightedHtml('', []));
            return;
        }

        setIsLoading(true);
        setError(null);
        setAiResult(null);
        setParaphraseResult(null);
        // Set initial highlighted content (plain text) while loading
        setHighlightedContent(generateHighlightedHtml(currentText, []));


        try {
            if (activeTab === AI_DETECTOR_TAB) {
                const result = await callGeminiApi(currentText);
                setAiResult(result);
                // Set the highlighted content after getting the result
                const html = generateHighlightedHtml(currentText, result.aiSentences);
                setHighlightedContent(html);
            }
            else if (activeTab === PARAPHRASE_CHECKER_TAB) {
                const result = await simulateParaphraseCheck(currentText);
                setParaphraseResult(result);
                // Paraphrase checker doesn't highlight, so just show plain text HTML
                const html = generateHighlightedHtml(currentText, []);
                setHighlightedContent(html);
            }
        } catch (err) {
            setError(`Failed to get result: ${err.message}. Please try again.`);
            // On error, still show the text they entered as plain text HTML
            const html = generateHighlightedHtml(currentText, []);
            setHighlightedContent(html);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        // When changing tabs, clear results but keep the text
        setAiResult(null);
        setParaphraseResult(null);
        setError(null);
        setIsLoading(false);
        // Reset highlighting to plain text
        const currentText = inputRef.current ? (inputRef.current.tagName === 'TEXTAREA' ? inputRef.current.value : inputRef.current.innerText) : inputText; // Use inputText if ref is null initially
        setHighlightedContent(generateHighlightedHtml(currentText, []));
    };

    // Determine if there is a result to display
    const hasResult = aiResult || paraphraseResult;

    // Get the current text content for the textarea/div
    // Use innerText for div, value for textarea, fallback to inputText state
    const currentInputValue = inputRef.current
        ? (inputRef.current.tagName === 'TEXTAREA' ? inputRef.current.value : inputRef.current.innerText)
        : inputText;


    // --- Render ---
    return (
        <div className="flex justify-center items-start min-h-screen bg-gray-900 font-sans p-4 pt-10">
            {/* Container adapts width based on whether results are shown */}
            <div className={`w-full ${hasResult ? 'max-w-6xl' : 'max-w-2xl'} bg-gray-blue rounded-xl shadow-2xl overflow-hidden my-8 transition-all duration-500 ease-in-out`}>
                <header className="p-6">
                    <h1 className="text-3xl font-bold text-white text-center">
                        Content Authenticity Checker
                    </h1>
                    <p className="text-gray-400 text-center mt-1">
                        Check for AI generation and paraphrase percentage.
                    </p>
                </header>

                <nav className="flex bg-gray-blue/50 border-b border-gray-700">
                    <TabButton title="AI Detector" isActive={activeTab === AI_DETECTOR_TAB} onClick={() => handleTabChange(AI_DETECTOR_TAB)} />
                    <TabButton title="Paraphrase Checker" isActive={activeTab === PARAPHRASE_CHECKER_TAB} onClick={() => handleTabChange(PARAPHRASE_CHECKER_TAB)} />
                </nav>

                {/* --- Main Content Grid ---
              - Default: 1 column
              - When hasResult is true: 1 column on small screens, 2 columns on medium+ screens
        --- */}
                <div className={`grid ${hasResult ? 'grid-cols-1 md:grid-cols-2 gap-x-8' : 'grid-cols-1'} transition-all duration-500 ease-in-out`}>

                    {/* --- Column 1: Text Input Area --- */}
                    <div className="p-6 md:p-8 flex flex-col">
                        {/* Switch between editable div (for highlighting) and textarea (for initial input) */}
                        {hasResult ? (
                            <div
                                ref={inputRef} // Use the ref here
                                className="w-full h-96 p-4 border border-gray-700 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-milk overflow-y-auto flex-grow" // Added flex-grow
                                // Use dangerouslySetInnerHTML to render highlights
                                dangerouslySetInnerHTML={{ __html: highlightedContent }}
                                // Make it act like an input (optional, styling might be needed)
                                contentEditable={false} // Make it non-editable after analysis
                                suppressContentEditableWarning={true}
                            />
                        ) : (
                            <textarea
                                ref={inputRef} // Use the ref here
                                className="w-full h-96 p-4 border border-gray-700 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-milk resize-none placeholder-gray-500 flex-grow" // Added flex-grow
                                placeholder="Paste text here to check..."
                                // Control the textarea value with state before the first analysis
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                disabled={isLoading}
                            />
                        )}

                        <button
                            onClick={handleSubmit}
                            disabled={isLoading}
                            className="w-full mt-4 p-4 bg-milk text-gray-blue font-semibold rounded-lg shadow-md hover:bg-opacity-90 transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex justify-center items-center"
                        >
                            {isLoading ? <Spinner /> : 'Analyze Text'}
                        </button>
                        {error && (
                            <div className="mt-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-lg">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* --- Column 2: Results Area (Only rendered if hasResult is true) --- */}
                    {hasResult && (
                        <div className="p-6 md:p-8 border-t md:border-t-0 md:border-l border-gray-700"> {/* Add border for separation */}
                            {isLoading && (
                                <div className="text-center text-gray-400 h-full flex items-center justify-center">
                                    Checking...
                                </div>
                            )}

                            {!isLoading && activeTab === AI_DETECTOR_TAB && aiResult && (
                                <AiResultDisplay result={aiResult} />
                            )}

                            {!isLoading && activeTab === PARAPHRASE_CHECKER_TAB && paraphraseResult && (
                                <ParaphraseResultDisplay result={paraphraseResult} />
                            )}
                        </div>
                    )}

                </div> {/* End of grid */}
            </div> {/* End of main card */}
        </div> // End of page container
    );
}

// --- Helper Components ---
// (TabButton and Spinner remain the same)
function TabButton({ title, isActive, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 py-4 px-2 font-medium text-center transition-all duration-200 outline-none ${
                isActive
                    ? 'border-b-4 border-milk text-milk' // Active tab uses milk color
                    : 'text-gray-400 hover:bg-gray-700/30 hover:text-gray-200' // Inactive tab
            }`}
        >
            {title}
        </button>
    );
}

function Spinner() {
    return (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    );
}


// AiResultDisplay: Simplified, doesn't need originalText anymore
function AiResultDisplay({ result }) {
    const score = result ? Math.round(result.aiScore) : 0;
    const color = score > 75 ? 'text-red-400' : score > 40 ? 'text-yellow-400' : 'text-green-400';
    const confidence = score > 75 ? 'High Confidence' : score > 40 ? 'Medium Confidence' : 'Low Confidence';
    const sentencesDetected = result && Array.isArray(result.aiSentences) && result.aiSentences.length > 0;

    return (
        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 animate-fade-in h-full flex flex-col"> {/* Ensure it takes full height */}
            <h3 className="text-xl font-semibold text-white mb-4 text-center">AI Detection Result</h3>
            <div className="flex items-center justify-center space-x-4 mb-4">
                <div className={`text-6xl font-bold ${color}`}>{score}%</div>
                <div className="text-lg text-center">
                    <div className="font-semibold text-gray-200">Likely AI-Generated</div>
                    <div className={`text-sm ${color}`}>{confidence}</div>
                </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden mb-4">
                <div
                    className={`h-4 rounded-full transition-all duration-500 ease-in-out ${
                        score > 75 ? 'bg-red-500' : score > 40 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${score}%` }}
                ></div>
            </div>
            <div>
                <h4 className="font-semibold text-gray-200">Justification:</h4>
                <p className="text-gray-400 italic">"{result?.justification || 'N/A'}"</p>
            </div>
            {/* Message about where highlights are */}
            <div className="mt-4 text-sm text-gray-500 text-center flex-grow flex items-end justify-center"> {/* Pushes to bottom */}
                {sentencesDetected ? 'Highlighted sentences are shown in the text input area.' : 'No specific AI sentences detected with high confidence.'}
            </div>
        </div>
    );
}


// ParaphraseResultDisplay remains largely the same
function ParaphraseResultDisplay({ result }) {
    const score = result ? Math.round(result.plagiarismScore) : 0;
    const color = score > 15 ? 'text-red-400' : score > 5 ? 'text-yellow-400' : 'text-green-400';
    const matchLevel = score > 15 ? 'High Match' : score > 5 ? 'Possible Match' : 'Likely Original';

    return (
        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 animate-fade-in h-full flex flex-col"> {/* Ensure it takes full height */}
            <div className="bg-yellow-900/50 border-l-4 border-yellow-500 text-yellow-300 p-4 rounded-md mb-4">
                <h4 className="font-bold">Simulation Mode</h4>
                <p className="text-sm">This is a simulated result. Integrate a real plagiarism API for accurate checks.</p>
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
                <div
                    className={`h-4 rounded-full transition-all duration-500 ease-in-out ${
                        score > 15 ? 'bg-red-500' : score > 5 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${score}%` }}
                ></div>
            </div>

            <div className="mt-6 flex-grow overflow-y-auto"> {/* Allow scrolling if sources are many */}
                <h4 className="font-semibold text-gray-200 mb-2">Simulated Matched Sources:</h4>
                {result?.sources && result.sources.length > 0 ? (
                    <ul className="space-y-3">
                        {result.sources.map((source, index) => (
                            <li key={index} className="border border-gray-700 p-3 rounded-lg bg-gray-800">
                                <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-milk hover:underline font-medium block truncate text-sm" // Smaller text for URL
                                >
                                    {source.url}
                                </a>
                                <p className="text-gray-400 text-xs mt-1 italic">"{source.snippet}"</p> {/* Smaller text */}
                                <span className="text-xs font-semibold bg-red-800/50 text-red-300 px-2 py-0.5 rounded-full mt-2 inline-block">
                  {source.matchPercent}% Match
                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500 text-sm italic">No simulated sources found.</p>
                )}
            </div>
        </div>
    );
}

