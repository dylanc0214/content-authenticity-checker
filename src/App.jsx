import React, { useState, useEffect } from 'react';

// --- Constants ---
const AI_DETECTOR_TAB = 'ai';
const PARAPHRASE_CHECKER_TAB = 'paraphrase';

// --- Main App Component ---
export default function App() {
    const [activeTab, setActiveTab] = useState(AI_DETECTOR_TAB);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // State for AI Detector
    const [aiResult, setAiResult] = useState(null);

    // State for Paraphrase Checker
    const [paraphraseResult, setParaphraseResult] = useState(null);

    // --- API Call: AI Detector (REAL & SECURE) ---
    // This function now asks the AI for *specific sentences*
    const callGeminiApi = async (text, retries = 3, delay = 1000) => {

        // This is the new system prompt
        const systemPrompt = `You are an AI text detector. Analyze the following text and provide your assessment. Your response MUST be in the JSON format defined in the schema.
1.  Provide an \`aiScore\` (a number from 0-100)
2.  Provide a brief \`justification\` for the score.
3.  Most importantly: Identify the *exact sentences* from the user's text that are most likely AI-generated. Return these sentences in the \`aiSentences\` array. Only include sentences with high confidence of being AI. If no sentences are detected, return an empty array.`;

        // This is the new response schema
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

        // We call *our own* backend function at /api/check-ai
        // This code remains the same as before.
        try {
            const response = await fetch('/api/check-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `API Error: ${response.status}`);
            }

            const result = await response.json();

            if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
                const jsonText = result.candidates[0].content.parts[0].text;
                return JSON.parse(jsonText);
            } else {
                console.error("Unexpected API response structure:", result);
                throw new Error("Invalid response from AI detector.");
            }

        } catch (err) {
            if (retries > 0 && err.message.includes("429")) {
                await new Promise(res => setTimeout(res, delay));
                return callGeminiApi(text, retries - 1, delay * 2);
            } else {
                console.error("AI Detector API Error:", err);
                throw err;
            }
        }
    };

    // --- API Call: Paraphrase Checker (SIMULATED) ---
    const simulateParaphraseCheck = (text) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const fakeScore = Math.floor(Math.random() * 25) + 5;
                const fakeResult = {
                    plagiarismScore: fakeScore,
                    sources: [
                        {
                            url: 'https://www.simulated-source-one.com/article/example',
                            snippet: '...this part of the text seems very similar to content found on...',
                            matchPercent: 12
                        },
                        {
                            url: 'https://www.fake-journal-entry.org/page/2',
                            snippet: '...our database found a potential match for the phrase...',
                            matchPercent: 8
                        }
                    ]
                };
                resolve(fakeResult);
            }, 1500);
        });
    };

    // --- Event Handlers ---
    const handleSubmit = async () => {
        if (!inputText.trim()) {
            setError("Please enter some text to check.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setAiResult(null);
        setParaphraseResult(null);

        try {
            if (activeTab === AI_DETECTOR_TAB) {
                const result = await callGeminiApi(inputText);
                setAiResult(result);
            }
            else if (activeTab === PARAPHRASE_CHECKER_TAB) {
                const result = await simulateParaphraseCheck(inputText);
                setParaphraseResult(result);
            }
        } catch (err) {
            setError(`Failed to get result: ${err.message}. Please try again.`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setInputText('');
        setAiResult(null);
        setParaphraseResult(null);
        setError(null);
        setIsLoading(false);
    };

    // --- Render ---
    return (
        // New dark theme using your colors
        <div className="flex justify-center items-center min-h-screen bg-gray-900 font-sans p-4">
            <div className="w-full max-w-2xl bg-gray-blue rounded-xl shadow-2xl overflow-hidden my-8">
                <header className="p-6">
                    <h1 className="text-3xl font-bold text-white text-center">
                        Content Authenticity Checker
                    </h1>
                    <p className="text-gray-400 text-center mt-1">
                        Check for AI generation and paraphrase percentage.
                    </p>
                </header>

                {/* --- Tab Navigation (New Colors) --- */}
                <nav className="flex bg-gray-blue/50 border-b border-gray-700">
                    <TabButton
                        title="AI Detector"
                        isActive={activeTab === AI_DETECTOR_TAB}
                        onClick={() => handleTabChange(AI_DETECTOR_TAB)}
                    />
                    <TabButton
                        title="Paraphrase Checker"
                        isActive={activeTab === PARAPHRASE_CHECKER_TAB}
                        onClick={() => handleTabChange(PARAPHRASE_CHECKER_TAB)}
                    />
                </nav>

                {/* --- Main Content Area (New Colors) --- */}
                <main className="p-6 md:p-8">
          <textarea
              className="w-full h-48 p-4 border border-gray-700 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-milk-orange resize-none placeholder-gray-500"
              placeholder={
                  activeTab === AI_DETECTOR_TAB
                      ? "Paste text here to check for AI generation..."
                      : "Paste text here to check for plagiarism/paraphrasing..."
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
          />

                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="w-full mt-4 p-4 bg-milk-orange text-white font-semibold rounded-lg shadow-md hover:bg-opacity-90 transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex justify-center items-center"
                    >
                        {isLoading ? <Spinner /> : 'Analyze Text'}
                    </button>

                    {error && (
                        <div className="mt-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* --- Results Display --- */}
                    <div className="mt-6">
                        {isLoading && (
                            <div className="text-center text-gray-400">
                                Checking... this might take a moment.
                            </div>
                        )}

                        {activeTab === AI_DETECTOR_TAB && aiResult && !isLoading && (
                            <AiResultDisplay result={aiResult} originalText={inputText} />
                        )}

                        {activeTab === PARAPHRASE_CHECKER_TAB && paraphraseResult && !isLoading && (
                            <ParaphraseResultDisplay result={paraphraseResult} />
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

// --- Helper Components ---

function TabButton({ title, isActive, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 py-4 px-2 font-medium text-center transition-all duration-200 outline-none ${
                isActive
                    ? 'border-b-4 border-milk-orange text-milk-orange'
                    : 'text-gray-400 hover:bg-gray-700/30 hover:text-gray-200'
            }`}
        >
            {title}
        </button>
    );
}

function Spinner() {
    return (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    );
}

// --- This helper function is needed to safely highlight text ---
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function AiResultDisplay({ result, originalText }) {
    const score = Math.round(result.aiScore);
    const color =
        score > 75 ? 'text-red-400' : score > 40 ? 'text-yellow-400' : 'text-green-400';

    // --- NEW HIGHLIGHTING LOGIC ---
    const getHighlightedText = () => {
        let highlightedText = originalText;

        // We need to escape newlines for the HTML render
        highlightedText = highlightedText.replace(/\n/g, '<br />');

        if (result.aiSentences && result.aiSentences.length > 0) {
            result.aiSentences.forEach(sentence => {
                // We must escape the sentence so it can be used in a Regex
                const escapedSentence = escapeRegExp(sentence);
                const regex = new RegExp(escapedSentence, 'g');
                highlightedText = highlightedText.replace(regex, `<mark>$&</mark>`);
            });
        }
        return highlightedText;
    };

    const highlightedHtml = getHighlightedText();
    // --- END OF NEW LOGIC ---

    return (
        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 animate-fade-in">
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
                <div
                    className={`h-4 rounded-full transition-all duration-500 ${
                        score > 75 ? 'bg-red-500' : score > 40 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${score}%` }}
                ></div>
            </div>
            <div className="mt-4">
                <h4 className="font-semibold text-gray-200">Justification:</h4>
                <p className="text-gray-400 italic">"{result.justification}"</p>
            </div>

            {/* --- NEW HIGHLIGHT SECTION --- */}
            {result.aiSentences && result.aiSentences.length > 0 && (
                <div className="mt-6">
                    <h4 className="font-semibold text-gray-200 mb-3">Detected AI Text:</h4>
                    <div
                        className="p-4 border border-gray-700 rounded-lg bg-gray-900 text-gray-300 max-h-48 overflow-y-auto leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                    />
                </div>
            )}
        </div>
    );
}

function ParaphraseResultDisplay({ result }) {
    const score = Math.round(result.plagiarismScore);
    const color =
        score > 15 ? 'text-red-400' : score > 5 ? 'text-yellow-400' : 'text-green-400';

    return (
        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 animate-fade-in">
            <div className="bg-yellow-900/50 border-l-4 border-yellow-500 text-yellow-300 p-4 rounded-md mb-4">
                <h4 className="font-bold">Simulation Mode</h4>
                <p className="text-sm">
                    This is a simulated result. To check against real-world sources, you'll
                    need to integrate a paid plagiarism API (like Copyscape).
                </p>
            </div>

            <h3 className="text-xl font-semibold text-white mb-4">Paraphrase Check Result</h3>

            <div className="flex items-center justify-center space-x-4 mb-4">
                <div className={`text-6xl font-bold ${color}`}>{score}%</div>
                <div className="text-lg">
                    <div className="font-semibold text-gray-200">Potential Plagiarism</div>
                    <div className={`text-sm ${color}`}>
                        {score > 15 ? 'High Match' : score > 5 ? 'Possible Match' : 'Likely Original'}
                    </div>
                </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                    className={`h-4 rounded-full transition-all duration-500 ${
                        score > 15 ? 'bg-red-500' : score > 5 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${score}%` }}
                ></div>
            </div>

            <div className="mt-6">
                <h4 className="font-semibold text-gray-200 mb-2">Simulated Matched Sources:</h4>
                <ul className="space-y-3">
                    {result.sources.map((source, index) => (
                        <li key={index} className="border border-gray-700 p-3 rounded-lg bg-gray-800">
                            <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-milk-orange hover:underline font-medium block truncate"
                            >
                                {source.url}
                            </a>
                            <p className="text-gray-400 text-sm mt-1">"{source.snippet}"</p>
                            <span className="text-xs font-semibold bg-red-800/50 text-red-300 px-2 py-0.5 rounded-full mt-2 inline-block">
                {source.matchPercent}% Match
              </span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

