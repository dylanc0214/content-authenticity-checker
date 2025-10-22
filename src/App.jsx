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
    const callGeminiApi = async (text, retries = 3, delay = 1000) => {
        try {
            // We now call *our own* backend function, not Google
            const response = await fetch('/api/check-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text }) // Send the text to our backend
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
            if (retries > 0 && err.message.includes("429")) { // Handle rate limiting
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
                // This is a fake result. A real API would return a score
                // and a list of matched sources.
                const fakeScore = Math.floor(Math.random() * 25) + 5; // 5-30%
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
            }, 1500); // Simulate network delay
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
                // --- TODO: REPLACE THIS WITH YOUR REAL API CALL ---
                // Example: const result = await realParaphraseApi(inputText, 'YOUR_API_KEY');
                const result = await simulateParaphraseCheck(inputText);
                setParaphraseResult(result);
                // --- END OF TODO ---
            }
        } catch (err) {
            setError(`Failed to get result: ${err.message}. Please try again.`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        // Clear state when switching tabs
        setInputText('');
        setAiResult(null);
        setParaphraseResult(null);
        setError(null);
        setIsLoading(false);
    };

    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-100 font-sans p-4">
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden">
                <header className="bg-indigo-600 p-6">
                    <h1 className="text-3xl font-bold text-white text-center">
                        Content Authenticity Checker
                    </h1>
                    <p className="text-indigo-200 text-center mt-1">
                        Check for AI generation and paraphrase percentage.
                    </p>
                </header>

                {/* --- Tab Navigation --- */}
                <nav className="flex bg-gray-50 border-b border-gray-200">
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

                {/* --- Main Content Area --- */}
                <main className="p-6 md:p-8">
          <textarea
              className="w-full h-48 p-4 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
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
                        className="w-full mt-4 p-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed flex justify-center items-center"
                    >
                        {isLoading ? <Spinner /> : 'Analyze Text'}
                    </button>

                    {error && (
                        <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* --- Results Display --- */}
                    <div className="mt-6">
                        {isLoading && (
                            <div className="text-center text-gray-500">
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
            className={`flex-1 py-4 px-2 font-medium text-center transition-all duration-200 ${
                isActive
                    ? 'border-b-4 border-indigo-600 text-indigo-600'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
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

function AiResultDisplay({ result }) {
    const score = Math.round(result.aiScore);
    const color =
        score > 75 ? 'text-red-600' : score > 40 ? 'text-yellow-600' : 'text-green-600';

    return (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 animate-fade-in">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">AI Detection Result</h3>
            <div className="flex items-center justify-center space-x-4 mb-4">
                <div className={`text-6xl font-bold ${color}`}>{score}%</div>
                <div className="text-lg">
                    <div className="font-semibold text-gray-700">Likely AI-Generated</div>
                    <div className={`text-sm ${color}`}>
                        {score > 75 ? 'High Confidence' : score > 40 ? 'Medium Confidence' : 'Low Confidence'}
                    </div>
                </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                    className={`h-4 rounded-full transition-all duration-500 ${
                        score > 75 ? 'bg-red-500' : score > 40 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${score}%` }}
                ></div>
            </div>
            <div className="mt-4">
                <h4 className="font-semibold text-gray-700">Justification:</h4>
                <p className="text-gray-600 italic">"{result.justification}"</p>
            </div>
        </div>
    );
}

function ParaphraseResultDisplay({ result }) {
    const score = Math.round(result.plagiarismScore);
    const color =
        score > 15 ? 'text-red-600' : score > 5 ? 'text-yellow-600' : 'text-green-600';

    return (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 animate-fade-in">
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md mb-4">
                <h4 className="font-bold">Simulation Mode</h4>
                <p className="text-sm">
                    This is a simulated result. To check against real-world sources, you'll
                    need to integrate a paid plagiarism API (like Copyscape). See the code
                    comments for details.
                </p>
            </div>

            <h3 className="text-xl font-semibold text-gray-800 mb-4">Paraphrase Check Result</h3>

            <div className="flex items-center justify-center space-x-4 mb-4">
                <div className={`text-6xl font-bold ${color}`}>{score}%</div>
                <div className="text-lg">
                    <div className="font-semibold text-gray-700">Potential Plagiarism</div>
                    <div className={`text-sm ${color}`}>
                        {score > 15 ? 'High Match' : score > 5 ? 'Possible Match' : 'Likely Original'}
                    </div>
                </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                    className={`h-4 rounded-full transition-all duration-500 ${
                        score > 15 ? 'bg-red-500' : score > 5 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${score}%` }}
                ></div>
            </div>

            <div className="mt-6">
                <h4 className="font-semibold text-gray-700 mb-2">Simulated Matched Sources:</h4>
                <ul className="space-y-3">
                    {result.sources.map((source, index) => (
                        <li key={index} className="border border-gray-200 p-3 rounded-lg bg-white">
                            <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:underline font-medium block truncate"
                            >
                                {source.url}
                            </a>
                            <p className="text-gray-600 text-sm mt-1">"{source.snippet}"</p>
                            <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full mt-2 inline-block">
                {source.matchPercent}% Match
              </span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
