import React, { useState, useRef, useEffect } from 'react'; // Added useEffect

// --- Constants ---
const AI_DETECTOR_TAB = 'ai';
const PARAPHRASE_CHECKER_TAB = 'paraphrase';

// --- Main App Component ---
export default function App() {
    const [activeTab, setActiveTab] = useState(AI_DETECTOR_TAB);
    const [inputText, setInputText] = useState(''); // Tracks initial user input
    const [isLoading, setIsLoading] = useState(false); // Loading for analysis
    const [error, setError] = useState(null); // Error for analysis
    const [aiResult, setAiResult] = useState(null);
    const [paraphraseResult, setParaphraseResult] = useState(null);
    const inputRef = useRef(null); // Ref for textarea or div
    const [highlightedContent, setHighlightedContent] = useState(''); // HTML for the div

    // --- NEW States for Paraphrasing ---
    const [isParaphrasing, setIsParaphrasing] = useState(false);
    const [paraphraseError, setParaphraseError] = useState(null);
    const [currentTextInEditor, setCurrentTextInEditor] = useState(''); // Tracks text currently displayed


    // --- API Call: AI Detector (Unchanged) ---
    const callGeminiApi = async (text, retries = 3, delay = 1000) => {
        const payload = { contents: [{ parts: [{ text: text }] }] };
        try {
            // Assumes your check-ai endpoint handles the system prompt and schema
            const response = await fetch('/api/check-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) { let errorBody; try { errorBody = await response.json(); } catch (e) { errorBody = { error: await response.text() }; } throw new Error(errorBody.error || `API Error: ${response.status}`); }
            const result = await response.json();
            // Check the actual response structure from your /api/check-ai
            if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
                const jsonText = result.candidates[0].content.parts[0].text;
                try { return JSON.parse(jsonText); } // Parse the JSON string
                catch(parseError) { console.error("Failed to parse JSON response from /api/check-ai:", jsonText, parseError); throw new Error("Malformed data received from AI detector backend."); }
            } else {
                console.error("Unexpected API response structure from /api/check-ai:", result);
                let errorMsg = "Invalid response structure from AI detector backend.";
                // Add more specific error handling if possible based on your backend structure
                if (result.promptFeedback?.blockReason) { errorMsg = `Request blocked by AI detector backend: ${result.promptFeedback.blockReason}`; }
                else if (!result.candidates || result.candidates.length === 0) { errorMsg = "AI detector backend provided no response candidate."; }
                throw new Error(errorMsg);
            }
        } catch (err) {
            // Keep existing retry logic
            if (retries > 0 && err.message.includes("429")) { await new Promise(res => setTimeout(res, delay)); return callGeminiApi(text, retries - 1, delay * 2); }
            else { console.error("AI Detector API Call Error:", err); throw err; } // Log and re-throw
        }
    };

    // --- NEW API Call: Paraphrase Text ---
    const callParaphraseApi = async (textToParaphrase, retries = 3, delay = 1000) => {
        try {
            const response = await fetch('/api/paraphrase-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ textToParaphrase }) // Send text in correct format
            });

            if (!response.ok) {
                let errorBody;
                try { errorBody = await response.json(); }
                catch (e) { errorBody = { error: await response.text() }; } // Fallback
                // Give specific error for safety blocks
                if (response.status === 400 && errorBody.error && errorBody.error.includes("blocked")) {
                    throw new Error(errorBody.error); // Show the block reason
                }
                throw new Error(errorBody.error || `API Error: ${response.status}`);
            }

            const result = await response.json();

            if (result && result.paraphrasedText) {
                return result.paraphrasedText; // Return just the text string
            } else {
                console.error("Unexpected paraphrase response:", result);
                throw new Error("Failed to get paraphrased text.");
            }
        } catch (err) {
            // Basic retry for rate limits, could be expanded
            if (retries > 0 && err.message.includes("429")) {
                await new Promise(res => setTimeout(res, delay));
                return callParaphraseApi(textToParaphrase, retries - 1, delay * 2);
            } else {
                console.error("Paraphrase API Error:", err);
                throw err; // Re-throw other errors
            }
        }
    };


    // --- API Call: Paraphrase Checker (SIMULATED - unchanged) ---
    const simulateParaphraseCheck = (text) => { return new Promise((resolve) => { setTimeout(() => { resolve({ plagiarismScore: Math.floor(Math.random() * 25) + 5, sources: [{ url: 'https://www.simulated-source-one.com/article/example', snippet: '...', matchPercent: 12 }, { url: 'https://www.fake-journal-entry.org/page/2', snippet: '...', matchPercent: 8 }] }); }, 1500); }); };

    // --- Helper to escape Regex characters (Unchanged) ---
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // --- Updated Highlighting Function (Handles new structure) ---
    const generateHighlightedHtml = (originalText, highConfidence = [], mediumConfidence = []) => {
        let highlightedText = originalText;
        // Basic sanitization
        highlightedText = highlightedText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        highlightedText = highlightedText.replace(/\n/g, '<br />'); // Handle newlines

        const highSentences = Array.isArray(highConfidence) ? highConfidence : [];
        const mediumSentences = Array.isArray(mediumConfidence) ? mediumConfidence : [];

        // Apply HIGH confidence first
        if (highSentences.length > 0) {
            highSentences.forEach(sentence => {
                const sanitizedSentence = sentence.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                try {
                    const regex = new RegExp(escapeRegExp(sanitizedSentence), 'g');
                    highlightedText = highlightedText.replace(regex, `<mark class="ai-highlight-high">$&</mark>`);
                } catch (e) { console.error("Regex error high:", sentence, e); }
            });
        }

        // Apply MEDIUM confidence, avoiding double highlighting
        if (mediumSentences.length > 0) {
            let processedText = '';
            // Split by high highlights to process segments in between
            const segments = highlightedText.split(/(<mark class="ai-highlight-high">.*?<\/mark>)/);

            segments.forEach((segment) => {
                if (!segment.startsWith('<mark class="ai-highlight-high">')) {
                    let currentSegment = segment;
                    mediumSentences.forEach(sentence => {
                        const sanitizedSentence = sentence.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        try {
                            // Important: Only replace if the sentence IS NOT already inside a high-highlight tag added previously
                            // This simple regex replace might still overlap if medium sentence contains part of high one,
                            // but prevents direct double-wrapping. More robust solution would involve DOM parsing.
                            const regex = new RegExp(escapeRegExp(sanitizedSentence), 'g');
                            currentSegment = currentSegment.replace(regex, (match) => {
                                // Basic check to avoid re-highlighting inside high marks, might need refinement
                                if (currentSegment.substring(currentSegment.indexOf(match) - 30, currentSegment.indexOf(match)).includes('ai-highlight-high')) {
                                    return match; // Don't highlight if likely already inside a high mark
                                }
                                return `<mark class="ai-highlight-medium">${match}</mark>`;
                            });
                        } catch (e) { console.error("Regex error medium:", sentence, e); }
                    });
                    processedText += currentSegment;
                } else {
                    processedText += segment; // Add back high highlight untouched
                }
            });
            highlightedText = processedText;
        }

        return highlightedText;
    };

    // --- Effect to update currentTextInEditor when highlightedContent changes ---
    // Needed to get the plain text for the paraphrase function
    useEffect(() => {
        if (inputRef.current) {
            // Use innerText to get text without HTML tags from the div
            setCurrentTextInEditor(inputRef.current.innerText);
        }
        // If not using div (initial state or error), sync with inputText
        else if (!hasResult && !highlightedContent) {
            setCurrentTextInEditor(inputText);
        }
    }, [highlightedContent, inputText, hasResult]); // Added dependencies


    // --- Event Handlers ---
    const handleSubmit = async () => {
        let currentText = inputText; // Start with state
        if (inputRef.current) { // Prefer text currently in the editor if it exists
            currentText = inputRef.current.tagName === 'TEXTAREA' ? inputRef.current.value : inputRef.current.innerText;
        }

        if (!currentText || !currentText.trim()) { // Check if currentText is null or empty after trim
            setError("Please enter some text to check.");
            setHighlightedContent(generateHighlightedHtml('', [], []));
            setCurrentTextInEditor('');
            return;
        }

        setIsLoading(true);
        setError(null);
        setParaphraseError(null);
        setAiResult(null);
        setParaphraseResult(null);
        // Display plain text version (HTML formatted) while loading
        setHighlightedContent(generateHighlightedHtml(currentText, [], []));
        setCurrentTextInEditor(currentText); // Update editor text state immediately

        try {
            if (activeTab === AI_DETECTOR_TAB) {
                const result = await callGeminiApi(currentText);
                setAiResult(result);
                const html = generateHighlightedHtml(
                    currentText,
                    result.highConfidenceSentences, // Use correct property names from API
                    result.mediumConfidenceSentences
                );
                setHighlightedContent(html);
                // CurrentTextInEditor is updated via useEffect based on highlightedContent
            } else if (activeTab === PARAPHRASE_CHECKER_TAB) {
                const result = await simulateParaphraseCheck(currentText);
                setParaphraseResult(result);
                const html = generateHighlightedHtml(currentText, [], []);
                setHighlightedContent(html);
                // CurrentTextInEditor is updated via useEffect
            }
        } catch (err) {
            setError(`Analysis failed: ${err.message}. Please try again.`);
            const html = generateHighlightedHtml(currentText, [], []); // Show plain text on error
            setHighlightedContent(html);
            // CurrentTextInEditor is updated via useEffect
        } finally {
            setIsLoading(false);
        }
    };

    // --- Handler for Paraphrase Button ---
    const handleParaphraseClick = async () => {
        // Use the state variable holding the plain text
        if (!currentTextInEditor || currentTextInEditor.trim() === '') {
            setParaphraseError("No text available to paraphrase.");
            return;
        }

        setIsParaphrasing(true);
        setParaphraseError(null);
        setError(null); // Clear analysis error

        try {
            const paraphrased = await callParaphraseApi(currentTextInEditor); // Paraphrase the plain text

            // Update the displayed content with the NEW paraphrased text
            setHighlightedContent(generateHighlightedHtml(paraphrased, [], [])); // Display as plain HTML
            setInputText(paraphrased); // Update the underlying state (for textarea fallback)
            // currentTextInEditor will be updated by the useEffect

            // Clear previous results as the text has changed
            setAiResult(null);
            setParaphraseResult(null);

            // --- Optional: Automatically re-run AI check ---
            // Let's add a small delay before re-analyzing for better UX
            /*
            setTimeout(async () => {
                try {
                   setIsLoading(true); // Show analysis spinner
                   setError(null); // Clear previous analysis error
                   const newAiResult = await callGeminiApi(paraphrased);
                   setAiResult(newAiResult);
                   const newHtml = generateHighlightedHtml(paraphrased, newAiResult.highConfidenceSentences, newAiResult.mediumConfidenceSentences);
                   setHighlightedContent(newHtml);
                } catch (reanalysisError) {
                    setError(`Re-analysis failed: ${reanalysisError.message}`);
                    // Keep the paraphrased (but unhighlighted) text visible
                    setHighlightedContent(generateHighlightedHtml(paraphrased, [], []));
                } finally {
                    setIsLoading(false);
                }
            }, 500); // 500ms delay
            */
            // --- End Optional Re-analysis ---


        } catch(err) {
            setParaphraseError(`Paraphrasing failed: ${err.message}`);
            // Keep the original highlighted text visible on error
        } finally {
            setIsParaphrasing(false);
        }
    };


    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setAiResult(null);
        setParaphraseResult(null);
        setError(null);
        setParaphraseError(null);
        setIsLoading(false);
        setIsParaphrasing(false);
        // Reset highlights based on the text currently in view
        const currentText = inputRef.current ? (inputRef.current.tagName === 'TEXTAREA' ? inputRef.current.value : inputRef.current.innerText) : inputText;
        setHighlightedContent(generateHighlightedHtml(currentText, [], []));
        setCurrentTextInEditor(currentText); // Ensure state matches view
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
                    <TabButton title="Plagiarism Checker" isActive={activeTab === PARAPHRASE_CHECKER_TAB} onClick={() => handleTabChange(PARAPHRASE_CHECKER_TAB)} />
                </nav>

                {/* --- Main Content Grid --- */}
                <div className={`grid ${hasResult ? 'grid-cols-1 md:grid-cols-2 gap-x-8' : 'grid-cols-1'} transition-all duration-500 ease-in-out`}>

                    {/* --- Column 1: Text Input Area --- */}
                    <div className="p-6 md:p-8 flex flex-col">
                        {/* Input Div/Textarea */}
                        {hasResult || highlightedContent ? (
                            <div
                                ref={inputRef}
                                key={highlightedContent} // Force re-render
                                className="w-full h-96 p-4 border border-gray-700 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-milk overflow-y-auto flex-grow prose prose-invert max-w-none prose-mark:p-0 prose-mark:rounded-none prose-mark:bg-opacity-100" // Reset mark styles locally
                                dangerouslySetInnerHTML={{ __html: highlightedContent || generateHighlightedHtml(inputText, [], []) }}
                                contentEditable={false} // Display only, not editable after result
                                suppressContentEditableWarning={true}
                            />
                        ) : (
                            <textarea
                                ref={inputRef}
                                className="w-full h-96 p-4 border border-gray-700 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-milk resize-none placeholder-gray-500 flex-grow"
                                placeholder="Paste text here to check..."
                                value={inputText}
                                onChange={(e) => {
                                    setInputText(e.target.value);
                                    setCurrentTextInEditor(e.target.value);
                                    // No need to update highlightedContent here unless you want instant preview
                                }}
                                disabled={isLoading || isParaphrasing}
                            />
                        )}

                        {/* Highlight Legend */}
                        {activeTab === AI_DETECTOR_TAB && hasResult && aiResult && (
                            <HighlightLegend />
                        )}

                        {/* Analyze Button and Error Messages */}
                        <button
                            onClick={handleSubmit}
                            disabled={isLoading || isParaphrasing}
                            className="w-full mt-4 p-4 bg-milk text-gray-blue font-semibold rounded-lg shadow-md hover:bg-opacity-90 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                        >
                            {isLoading ? <Spinner text="Analyzing..." /> : 'Analyze Text'}
                        </button>
                        {error && (
                            <div className="mt-2 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-lg text-sm">
                                {error}
                            </div>
                        )}
                        {paraphraseError && (
                            <div className="mt-2 p-3 bg-yellow-900/50 border border-yellow-700 text-yellow-300 rounded-lg text-sm">
                                {paraphraseError}
                            </div>
                        )}
                    </div>

                    {/* --- Column 2: Results Area --- */}
                    {hasResult && (
                        <div className="p-6 md:p-8 border-t md:border-t-0 md:border-l border-gray-700">
                            {/* Show specific loading state */}
                            {(isLoading || isParaphrasing) && (
                                <div className="text-center text-gray-400 h-full flex items-center justify-center">
                                    {isParaphrasing ? 'Paraphrasing...' : 'Checking...'}
                                </div>
                            )}
                            {/* Show results only when not loading */}
                            {!isLoading && !isParaphrasing && activeTab === AI_DETECTOR_TAB && aiResult && (
                                <AiResultDisplay
                                    result={aiResult}
                                    onParaphraseClick={handleParaphraseClick}
                                    isParaphrasing={isParaphrasing}
                                />
                            )}
                            {!isLoading && !isParaphrasing && activeTab === PARAPHRASE_CHECKER_TAB && paraphraseResult && (
                                <ParaphraseResultDisplay result={paraphraseResult} />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Helper Components ---

function HighlightLegend() { return (<div className="mt-3 text-xs text-gray-400 highlight-legend flex items-center space-x-4"><span className="font-medium">Key:</span><div className="flex items-center"><span style={{ backgroundColor: '#FFFFFF', color: '#2b323f', padding: '1px 4px', borderRadius: '3px', marginRight: '5px', fontWeight: '500' }}>White</span><span className="text-gray-400">- High AI Confidence</span></div><div className="flex items-center"><span style={{ backgroundColor: '#4b5563', color: '#FDFDF1', padding: '1px 4px', borderRadius: '3px', marginRight: '5px' }}>Grey</span><span className="text-gray-400">- Medium AI Confidence</span></div></div>); }
function TabButton({ title, isActive, onClick }) { return (<button onClick={onClick} className={`flex-1 py-4 px-2 font-medium text-center transition-all duration-200 outline-none ${ isActive ? 'border-b-4 border-milk text-milk' : 'text-gray-400 hover:bg-gray-700/30 hover:text-gray-200'}`}>{title}</button>); }
function Spinner({ text = "" }) { return (<><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>{text && <span>{text}</span>}</>); }

// --- Updated AiResultDisplay to include Paraphrase Button ---
function AiResultDisplay({ result, onParaphraseClick, isParaphrasing }) {
    const score = result ? Math.round(result.aiScore) : 0;
    const color = score > 75 ? 'text-red-400' : score > 40 ? 'text-yellow-400' : 'text-green-400';
    const confidence = score > 75 ? 'High Confidence' : score > 40 ? 'Medium Confidence' : 'Low Confidence';
    const sentencesDetected = result && ( (Array.isArray(result.highConfidenceSentences) && result.highConfidenceSentences.length > 0) || (Array.isArray(result.mediumConfidenceSentences) && result.mediumConfidenceSentences.length > 0) );
    const showParaphraseButton = score > 10; // Only show if AI score is significant

    return (
        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 animate-fade-in h-full flex flex-col justify-between">
            <div> {/* Main content */}
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
                    <p className="text-gray-400 italic text-sm">"{result?.justification || 'N/A'}"</p>
                </div>
                <div className="mt-4 text-sm text-gray-500 text-center">
                    {sentencesDetected ? 'Highlighted sentences shown in the text input.' : 'No specific AI sentences detected.'}
                </div>
            </div>

            {/* Paraphrase Button Section */}
            {showParaphraseButton && (
                <div className="mt-6 border-t border-gray-700 pt-4">
                    <p className="text-xs text-gray-400 mb-2 text-center">Make it sound more human? Try paraphrasing (beta).</p>
                    <button
                        onClick={onParaphraseClick}
                        disabled={isParaphrasing}
                        className="w-full p-3 bg-gray-600 text-milk font-medium rounded-lg shadow-sm hover:bg-gray-500 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                    >
                        {isParaphrasing ? <Spinner text="Paraphrasing..." /> : 'Paraphrase Text'}
                    </button>
                    <p className="text-[10px] text-gray-500 mt-1 text-center">Note: Review paraphrased text carefully. AI score may not always decrease.</p>
                </div>
            )}
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

