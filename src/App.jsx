import React, { useState, useRef, useEffect } from 'react';

// --- Constants ---
const AI_DETECTOR_TAB = 'ai';
const PARAPHRASE_CHECKER_TAB = 'paraphrase';

// --- Main App Component ---
export default function App() {
    const [activeTab, setActiveTab] = useState(AI_DETECTOR_TAB);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // State for results
    const [aiResult, setAiResult] = useState(null);
    const [paraphraseResult, setParaphraseResult] = useState(null);

    // This ref will hold the editable div
    const editableDivRef = useRef(null);

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
                throw new Error("Invalid response from AI detector.");
            }
        } catch (err) {
            if (retries > 0 && err.message.includes("429")) {
                await new Promise(res => setTimeout(res, delay));
                return callGeminiApi(text, retries - 1, delay * 2);
            } else {
                throw err;
            }
        }
    };

    // --- API Call: Paraphrase Checker (SIMULATED) ---
    const simulateParaphraseCheck = (text) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    plagiarismScore: Math.floor(Math.random() * 25) + 5,
                    sources: [{ url: 'https://www.simulated-source-one.com/article/example', snippet: '...', matchPercent: 12 }, { url: 'https://www.fake-journal-entry.org/page/2', snippet: '...', matchPercent: 8 }]
                });
            }, 1500);
        });
    };

    // --- This helper function is needed to safely highlight text ---
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // --- NEW: Function to generate and set highlighted HTML ---
    const generateHighlightedHtml = (originalText, sentencesToHighlight) => {
        let highlightedText = originalText;
        // Sanitize text for security before injecting as HTML
        highlightedText = highlightedText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Replace newlines for proper HTML rendering
        highlightedText = highlightedText.replace(/\n/g, '<br />');

        if (sentencesToHighlight && sentencesToHighlight.length > 0) {
            sentencesToHighlight.forEach(sentence => {
                const sanitizedSentence = sentence
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
                const regex = new RegExp(escapeRegExp(sanitizedSentence), 'g');
                highlightedText = highlightedText.replace(regex, `<mark>$&</mark>`);
            });
        }
        return highlightedText;
    };

    // --- Event Handlers ---
    const handleSubmit = async () => {
        const currentText = editableDivRef.current ? editableDivRef.current.innerText : inputText;
        if (!currentText.trim()) {
            setError("Please enter some text to check.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setAiResult(null);
        setParaphraseResult(null);

        try {
            if (activeTab === AI_DETECTOR_TAB) {
                const result = await callGeminiApi(currentText);
                setAiResult(result);
                // NEW: Set the highlighted content after getting the result
                const html = generateHighlightedHtml(currentText, result.aiSentences);
                setHighlightedContent(html);
            }
            else if (activeTab === PARAPHRASE_CHECKER_TAB) {
                const result = await simulateParaphraseCheck(currentText);
                setParaphraseResult(result);
                // Paraphrase checker doesn't highlight, so just show plain text
                const html = generateHighlightedHtml(currentText, []);
                setHighlightedContent(html);
            }
        } catch (err) {
            setError(`Failed to get result: ${err.message}. Please try again.`);
            // On error, still show the text they entered
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
        // Reset highlighting
        const currentText = editableDivRef.current ? editableDivRef.current.innerText : inputText;
        setHighlightedContent(generateHighlightedHtml(currentText, []));
    };

    const hasResult = aiResult || paraphraseResult;

    // --- Render ---
    return (
        <div className="flex justify-center items-start min-h-screen bg-gray-900 font-sans p-4 pt-10">
            {/* Use a larger max-width for the side-by-side view */}
            <div className={`w-full ${hasResult ? 'max-w-6xl' : 'max-w-2xl'} bg-gray-blue rounded-xl shadow-2xl overflow-hidden my-8 transition-all duration-500`}>
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

                {/* --- NEW CONDITIONAL LAYOUT --- */}
                <div className={`grid ${hasResult ? 'grid-cols-1 md:grid-cols-2 gap-4' : 'grid-cols-1'} transition-all duration-500`}>

                    {/* --- Column 1: Text Input --- */}
                    <div className="p-6 md:p-8">
                        {/* We switch between a div and textarea based on whether there's a result */}
                        {hasResult ? (
                            <div
                                ref={editableDivRef}
                                className="w-full h-96 p-4 border border-gray-700 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-milk overflow-y-auto"
                                dangerouslySetInnerHTML={{ __html: highlightedContent }}
                            />
                        ) : (
                            <textarea
                                ref={editableDivRef}
                                className="w-full h-96 p-4 border border-gray-700 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-milk resize-none placeholder-gray-500"
                                placeholder="Paste text here to check..."
                                onChange={(e) => setInputText(e.target.value)}
                                defaultValue={inputText}
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

                    {/* --- Column 2: Results (Only shows if there is a result) --- */}
                    <div className="p-6 md:p-8">
                        {isLoading && (
                            <div className="text-center text-gray-400 h-full flex items-center justify-center">
                                Checking... this might take a moment.
                            </div>
                        )}

                        {activeTab === AI_DETECTOR_TAB && aiResult && !isLoading && (
                            <AiResultDisplay result={aiResult} />
                        )}

                        {activeTab === PARAPHRASE_CHECKER_TAB && paraphraseResult && !isLoading && (
                            <ParaphraseResultDisplay result={paraphraseResult} />
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}

// --- Helper Components ---
// (TabButton and Spinner are the same as before)
function TabButton({ title, isActive, onClick }) {
    return (
        <button onClick={onClick} className={`flex-1 py-4 px-2 font-medium text-center transition-all duration-200 outline-none ${isActive ? 'border-b-4 border-milk text-milk' : 'text-gray-400 hover:bg-gray-700/30 hover:text-gray-200'}`}>
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

// --- AiResultDisplay is now simpler ---
// It no longer needs to display the highlighted text
function AiResultDisplay({ result }) {
    const score = Math.round(result.aiScore);
    const color = score > 75 ? 'text-red-400' : score > 40 ? 'text-yellow-400' : 'text-green-400';

    return (
        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 animate-fade-in h-full">
            <h3 className="text-xl font-semibold text-white mb-4">AI Detection Result</h3>
            <div className="flex items-center justify-center space-x-4 mb-4">
                <div className={`text-6xl font-bold ${color}`}>{score}%</div>
                <div className="text-lg">
                    <div className="font-semibold text-gray-200">Likely AI-Generated</div>
                    <div className={`text-sm ${color}`}>
                        {score > 75 ? 'High Confidence' : score > 40 ? 'Medium Confidence' : 'Low Confidence'}
                    </div>
                </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                <div className={`h-4 rounded-full transition-all duration-500 ${score > 75 ? 'bg-red-500' : score > 40 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${score}%` }}></div>
            </div>
            <div className="mt-4">
                <h4 className="font-semibold text-gray-200">Justification:</h4>
                <p className="text-gray-400 italic">"{result.justification}"</p>
            </div>
            {result.aiSentences && result.aiSentences.length === 0 && (
                <div className="mt-6 text-center text-gray-400 p-4 border border-dashed border-gray-700 rounded-lg">
                    No specific AI sentences were flagged with high confidence. The score is based on the overall writing style.
                </div>
            )}
        </div>
    );
}

// ParaphraseResultDisplay is the same as before
function ParaphraseResultDisplay({ result }) {
    const score = Math.round(result.plagiarismScore);
    const color = score > 15 ? 'text-red-400' : score > 5 ? 'text-yellow-400' : 'text-green-400';

    return (
        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 animate-fade-in h-full">
            <div className="bg-yellow-900/50 border-l-4 border-yellow-500 text-yellow-300 p-4 rounded-md mb-4">
                <h4 className="font-bold">Simulation Mode</h4>
                <p className="text-sm">This is a simulated result. To check against real-world sources, you'll need to integrate a paid plagiarism API.</p>
            </div>
            <h3 className="text-xl font-semibold text-white mb-4">Paraphrase Check Result</h3>
            <div className="flex items-center justify-center space-x-4 mb-4">
                <div className={`text-6xl font-bold ${color}`}>{score}%</div>
                <div className="text-lg">
                    <div className="font-semibold text-gray-200">Potential Plagiarism</div>
                    <div className={`text-sm ${color}`}>{score > 15 ? 'High Match' : score > 5 ? 'Possible Match' : 'Likely Original'}</div>
                </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                <div className={`h-4 rounded-full transition-all duration-500 ${score > 15 ? 'bg-red-500' : score > 5 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${score}%` }}></div>
            </div>
            <div className="mt-6">
                <h4 className="font-semibold text-gray-200 mb-2">Simulated Matched Sources:</h4>
                <ul className="space-y-3">
                    {result.sources.map((source, index) => (
                        <li key={index} className="border border-gray-700 p-3 rounded-lg bg-gray-800">
                            <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-milk hover:underline font-medium block truncate">{source.url}</a>
                            <p className="text-gray-400 text-sm mt-1">"{source.snippet}"</p>
                            <span className="text-xs font-semibold bg-red-800/50 text-red-300 px-2 py-0.5 rounded-full mt-2 inline-block">{source.matchPercent}% Match</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}