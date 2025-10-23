import React, { useState, useRef } from 'react';

// --- Constants ---
const AI_DETECTOR_TAB = 'ai';
const PLAGIARISM_CHECKER_TAB = 'plagiarism'; // Changed name for clarity

// --- Main App Component ---
export default function App() {
    const [activeTab, setActiveTab] = useState(AI_DETECTOR_TAB);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [aiResult, setAiResult] = useState(null);
    const [plagiarismResult, setPlagiarismResult] = useState(null); // Renamed state
    const inputRef = useRef(null);
    const [highlightedContent, setHighlightedContent] = useState('');
    const [isParaphrasing, setIsParaphrasing] = useState(false);
    const [paraphraseError, setParaphraseError] = useState(null);

    // --- API Call: AI Detector (Unchanged) ---
    const callGeminiApi = async (text, retries = 3, delay = 1000) => {
        // ... (keep existing callGeminiApi code) ...
        const payload = { contents: [{ parts: [{ text: text }] }] };
        try {
            const response = await fetch('/api/check-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) { let errorBody; try { errorBody = await response.json(); } catch (e) { errorBody = { error: await response.text() }; } throw new Error(errorBody.error || `API Error: ${response.status}`); }
            const result = await response.json();
            if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
                const jsonText = result.candidates[0].content.parts[0].text;
                try { return JSON.parse(jsonText); } catch(parseError) { console.error("Failed to parse JSON response from /api/check-ai:", jsonText, parseError); throw new Error("Malformed data received from AI detector backend."); }
            } else {
                console.error("Unexpected API response structure from /api/check-ai:", result);
                let errorMsg = "Invalid response structure from AI detector backend.";
                if (result.promptFeedback?.blockReason) { errorMsg = `Request blocked by AI detector backend: ${result.promptFeedback.blockReason}`; }
                else if (!result.candidates || result.candidates.length === 0) { errorMsg = "AI detector backend provided no response candidate."; }
                throw new Error(errorMsg);
            }
        } catch (err) {
            if (retries > 0 && err.message.includes("429")) { await new Promise(res => setTimeout(res, delay)); return callGeminiApi(text, retries - 1, delay * 2); }
            else { console.error("AI Detector API Call Error:", err); throw err; }
        }
    };

    // --- API Call: Paraphrase Text (Unchanged) ---
    const callParaphraseApi = async (textToParaphrase, retries = 3, delay = 1000) => {
        // ... (keep existing callParaphraseApi code) ...
        try {
            const response = await fetch('/api/paraphrase-text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ textToParaphrase }) });
            if (!response.ok) { let errorBody; try { errorBody = await response.json(); } catch (e) { errorBody = { error: await response.text() }; } if (response.status === 400 && errorBody.error && errorBody.error.includes("blocked")) { throw new Error(errorBody.error); } throw new Error(errorBody.error || `API Error: ${response.status}`); }
            const result = await response.json();
            if (result && result.paraphrasedText) { return result.paraphrasedText; }
            else { console.error("Unexpected paraphrase response:", result); throw new Error("Failed to get paraphrased text."); }
        } catch (err) {
            if (retries > 0 && err.message.includes("429")) { await new Promise(res => setTimeout(res, delay)); return callParaphraseApi(textToParaphrase, retries - 1, delay * 2); }
            else { console.error("Paraphrase API Error:", err); throw err; }
        }
    };

    // --- NEW API Call: Plagiarism Checker (REAL) ---
    const callPlagiarismApi = async (textToCheck, retries = 3, delay = 1000) => {
        try {
            const response = await fetch('/api/check-plagiarism', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ textToCheck }) // Send text
            });

            if (!response.ok) {
                let errorBody;
                try { errorBody = await response.json(); }
                catch (e) { errorBody = { error: await response.text() }; } // Fallback
                throw new Error(errorBody.error || `API Error: ${response.status}`);
            }

            const result = await response.json();

            // Basic check if the expected structure is returned
            if (result && typeof result.plagiarismScore !== 'undefined' && Array.isArray(result.sources)) {
                return result; // Return the { plagiarismScore, sources } object
            } else {
                console.error("Unexpected plagiarism response structure:", result);
                throw new Error("Invalid response from plagiarism checker backend.");
            }
        } catch (err) {
            // Basic retry for rate limits, could be expanded
            if (retries > 0 && err.message.includes("429")) { // Check for rate limit error
                await new Promise(res => setTimeout(res, delay));
                return callPlagiarismApi(textToCheck, retries - 1, delay * 2); // Retry
            } else {
                console.error("Plagiarism Check API Error:", err);
                throw err; // Re-throw other errors
            }
        }
    };

    // --- Helper to escape Regex characters (Unchanged) ---
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // --- Highlighting Function (Unchanged logic) ---
    const generateHighlightedHtml = (originalText, highConfidence = [], mediumConfidence = []) => {
        let highlightedText = originalText;
        highlightedText = highlightedText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        highlightedText = highlightedText.replace(/\n/g, '<br />');
        const highSentences = Array.isArray(highConfidence) ? highConfidence : [];
        const mediumSentences = Array.isArray(mediumConfidence) ? mediumConfidence : [];
        if (highSentences.length > 0) { highSentences.forEach(sentence => { const sanitizedSentence = sentence.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); try { const regex = new RegExp(escapeRegExp(sanitizedSentence), 'g'); highlightedText = highlightedText.replace(regex, `<mark class="ai-highlight-high">$&</mark>`); } catch (e) { console.error("Regex error high:", sentence, e); } }); }
        if (mediumSentences.length > 0) { let processedText = ''; const segments = highlightedText.split(/(<mark class="ai-highlight-high">.*?<\/mark>)/); segments.forEach((segment) => { if (!segment.startsWith('<mark class="ai-highlight-high">')) { let currentSegment = segment; mediumSentences.forEach(sentence => { const sanitizedSentence = sentence.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); try { const regex = new RegExp(escapeRegExp(sanitizedSentence), 'g'); currentSegment = currentSegment.replace(regex, (match) => { if (currentSegment.substring(currentSegment.indexOf(match) - 30, currentSegment.indexOf(match)).includes('ai-highlight-high')) { return match; } return `<mark class="ai-highlight-medium">${match}</mark>`; }); } catch (e) { console.error("Regex error medium:", sentence, e); } }); processedText += currentSegment; } else { processedText += segment; } }); highlightedText = processedText; }
        return highlightedText;
    };


    // --- Event Handlers ---
    const handleSubmit = async () => {
        let currentText = '';
        if (inputRef.current) {
            currentText = inputRef.current.tagName === 'TEXTAREA' ? inputRef.current.value : inputRef.current.innerText;
        } else {
            currentText = inputText;
        }

        if (!currentText || !currentText.trim()) {
            setError("Please enter some text to check.");
            setHighlightedContent(generateHighlightedHtml('', [], []));
            return;
        }

        setIsLoading(true);
        setError(null);
        setParaphraseError(null);
        setAiResult(null);
        setPlagiarismResult(null); // Clear plagiarism result
        setHighlightedContent(generateHighlightedHtml(currentText, [], [])); // Show plain text while loading

        try {
            if (activeTab === AI_DETECTOR_TAB) {
                const result = await callGeminiApi(currentText);
                setAiResult(result);
                const html = generateHighlightedHtml(
                    currentText,
                    result.highConfidenceSentences,
                    result.mediumConfidenceSentences
                );
                setHighlightedContent(html);
            }
            // --- UPDATED: Call real plagiarism check ---
            else if (activeTab === PLAGIARISM_CHECKER_TAB) {
                const result = await callPlagiarismApi(currentText); // Use the new function
                setPlagiarismResult(result); // Set the result state
                // No highlighting needed for plagiarism, keep plain text display
                const html = generateHighlightedHtml(currentText, [], []);
                setHighlightedContent(html);
            }
            // --- END UPDATE ---
        } catch (err) {
            // Use a more generic error message for the user
            setError(`Analysis failed: ${err.message}. Please check input or try again.`);
            const html = generateHighlightedHtml(currentText, [], []);
            setHighlightedContent(html);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Paraphrase Handler (Unchanged) ---
    const handleParaphraseClick = async () => {
        // ... (keep existing handleParaphraseClick code) ...
        let textToParaphrase = '';
        if (inputRef.current) { textToParaphrase = inputRef.current.innerText; }
        if (!textToParaphrase || textToParaphrase.trim() === '') { setParaphraseError("No text available to paraphrase."); return; }
        setIsParaphrasing(true); setParaphraseError(null); setError(null);
        try { const paraphrased = await callParaphraseApi(textToParaphrase); setHighlightedContent(generateHighlightedHtml(paraphrased, [], [])); setInputText(paraphrased); setAiResult(null); setPlagiarismResult(null); }
        catch(err) { setParaphraseError(`Paraphrasing failed: ${err.message}`); }
        finally { setIsParaphrasing(false); }
    };


    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setAiResult(null);
        setPlagiarismResult(null); // Use correct state name
        setError(null);
        setParaphraseError(null);
        setIsLoading(false);
        setIsParaphrasing(false);
        let currentText = '';
        if (inputRef.current) { currentText = inputRef.current.tagName === 'TEXTAREA' ? inputRef.current.value : inputRef.current.innerText; }
        else { currentText = inputText; }
        setHighlightedContent(generateHighlightedHtml(currentText, [], []));
    };

    const hasResult = aiResult || plagiarismResult; // Use correct state name

    // --- Render ---
    return (
        <div className="flex justify-center items-start min-h-screen bg-gray-900 font-sans p-4 pt-10">
            <div className={`w-full ${hasResult ? 'max-w-6xl' : 'max-w-2xl'} bg-gray-blue rounded-xl shadow-2xl overflow-hidden my-8 transition-all duration-500 ease-in-out`}>
                {/* Header and Tabs */}
                <header className="p-6">
                    <h1 className="text-3xl font-bold text-white text-center">OriCheck</h1>
                    <p className="text-gray-400 text-center mt-1">Your Ori checker for AI & Plagiarism.</p>
                </header>
                <nav className="flex bg-gray-blue/50 border-b border-gray-700">
                    <TabButton title="AI Detector" isActive={activeTab === AI_DETECTOR_TAB} onClick={() => handleTabChange(AI_DETECTOR_TAB)} />
                    {/* --- Update Tab Title and onClick --- */}
                    <TabButton title="Plagiarism Checker" isActive={activeTab === PLAGIARISM_CHECKER_TAB} onClick={() => handleTabChange(PLAGIARISM_CHECKER_TAB)} />
                </nav>

                {/* --- Main Content Grid --- */}
                <div className={`grid ${hasResult ? 'grid-cols-1 md:grid-cols-2 gap-x-8' : 'grid-cols-1'} transition-all duration-500 ease-in-out`}>

                    {/* --- Column 1: Text Input Area --- */}
                    <div className="p-6 md:p-8 flex flex-col">
                        {/* Input Div/Textarea */}
                        {hasResult || highlightedContent ? (
                            <div
                                ref={inputRef}
                                className="w-full h-96 p-4 border border-gray-700 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-milk overflow-y-auto flex-grow prose prose-invert max-w-none prose-mark:p-0 prose-mark:rounded-none prose-mark:bg-opacity-100"
                                dangerouslySetInnerHTML={{ __html: highlightedContent || generateHighlightedHtml(inputText, [], []) }}
                                contentEditable={false}
                                suppressContentEditableWarning={true}
                            />
                        ) : (
                            <textarea
                                ref={inputRef}
                                className="w-full h-96 p-4 border border-gray-700 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-milk resize-none placeholder-gray-500 flex-grow"
                                placeholder={
                                    activeTab === AI_DETECTOR_TAB
                                        ? "Paste text here to check for AI generation..."
                                        : "Paste text here to check for plagiarism..." // Update placeholder
                                }
                                value={inputText}
                                onChange={(e) => { setInputText(e.target.value); }}
                                disabled={isLoading || isParaphrasing}
                            />
                        )}

                        {/* Highlight Legend */}
                        {activeTab === AI_DETECTOR_TAB && hasResult && aiResult && ( <HighlightLegend /> )}

                        {/* Analyze Button and Error Messages */}
                        <button
                            onClick={handleSubmit}
                            disabled={isLoading || isParaphrasing}
                            className="w-full mt-4 p-4 bg-milk text-gray-blue font-semibold rounded-lg shadow-md hover:bg-opacity-90 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                        >
                            {isLoading ? <Spinner text="Analyzing..." /> : 'Analyze Text'}
                        </button>
                        {error && ( <div className="mt-2 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-lg text-sm">{error}</div> )}
                        {paraphraseError && ( <div className="mt-2 p-3 bg-yellow-900/50 border border-yellow-700 text-yellow-300 rounded-lg text-sm">{paraphraseError}</div> )}
                    </div>

                    {/* --- Column 2: Results Area --- */}
                    {hasResult && (
                        <div className="p-6 md:p-8 border-t md:border-t-0 md:border-l border-gray-700">
                            {(isLoading || isParaphrasing) && ( <div className="text-center text-gray-400 h-full flex items-center justify-center">{isParaphrasing ? 'Paraphrasing...' : 'Checking...'}</div> )}
                            {/* --- Update Result Display Logic --- */}
                            {!isLoading && !isParaphrasing && activeTab === AI_DETECTOR_TAB && aiResult && ( <AiResultDisplay result={aiResult} onParaphraseClick={handleParaphraseClick} isParaphrasing={isParaphrasing} /> )}
                            {!isLoading && !isParaphrasing && activeTab === PLAGIARISM_CHECKER_TAB && plagiarismResult && ( <PlagiarismResultDisplay result={plagiarismResult} /> )} {/* Use new component name */}
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
function AiResultDisplay({ result, onParaphraseClick, isParaphrasing }) { const score = result ? Math.round(result.aiScore) : 0; const color = score > 75 ? 'text-red-400' : score > 40 ? 'text-yellow-400' : 'text-green-400'; const confidence = score > 75 ? 'High Confidence' : score > 40 ? 'Medium Confidence' : 'Low Confidence'; const sentencesDetected = result && ( (Array.isArray(result.highConfidenceSentences) && result.highConfidenceSentences.length > 0) || (Array.isArray(result.mediumConfidenceSentences) && result.mediumConfidenceSentences.length > 0) ); const showParaphraseButton = score > 10; return ( <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 animate-fade-in h-full flex flex-col justify-between"> <div> <h3 className="text-xl font-semibold text-white mb-4 text-center">AI Detection Result</h3> <div className="flex items-center justify-center space-x-4 mb-4"> <div className={`text-6xl font-bold ${color}`}>{score}%</div> <div className="text-lg text-center"> <div className="font-semibold text-gray-200">Likely AI-Generated</div> <div className={`text-sm ${color}`}>{confidence}</div> </div> </div> <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden mb-4"> <div className={`h-4 rounded-full transition-all duration-500 ease-in-out ${ score > 75 ? 'bg-red-500' : score > 40 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${score}%` }}></div> </div> <div> <h4 className="font-semibold text-gray-200">Justification:</h4> <p className="text-gray-400 italic text-sm">"{result?.justification || 'N/A'}"</p> </div> <div className="mt-4 text-sm text-gray-500 text-center"> {sentencesDetected ? 'Highlighted sentences shown in the text input.' : 'No specific AI sentences detected.'} </div> </div> {showParaphraseButton && ( <div className="mt-6 border-t border-gray-700 pt-4"> <p className="text-xs text-gray-400 mb-2 text-center">Make it sound more human? Try paraphrasing (beta).</p> <button onClick={onParaphraseClick} disabled={isParaphrasing} className="w-full p-3 bg-gray-600 text-milk font-medium rounded-lg shadow-sm hover:bg-gray-500 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"> {isParaphrasing ? <Spinner text="Paraphrasing..." /> : 'Paraphrase Text'} </button> <p className="text-[10px] text-gray-500 mt-1 text-center">Note: Review paraphrased text carefully. AI score may not always decrease.</p> </div> )} </div> ); }

// --- UPDATED PlagiarismResultDisplay (Removed Simulation Warning) ---
function PlagiarismResultDisplay({ result }) {
    const score = result ? Math.round(result.plagiarismScore) : 0;
    const color = score > 15 ? 'text-red-400' : score > 5 ? 'text-yellow-400' : 'text-green-400';
    const matchLevel = score > 15 ? 'High Match' : score > 5 ? 'Possible Match' : 'Likely Original';
    const hasSources = result?.sources && result.sources.length > 0;

    return (
        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 animate-fade-in h-full flex flex-col">
            {/* REMOVED Simulation Mode Warning */}
            <h3 className="text-xl font-semibold text-white mb-4 text-center">Plagiarism Check Result</h3>
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
                <h4 className="font-semibold text-gray-200 mb-2">Matched Sources:</h4>
                {hasSources ? (
                    <ul className="space-y-3">
                        {result.sources.map((source, index) => (
                            <li key={index} className="border border-gray-700 p-3 rounded-lg bg-gray-800">
                                <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-milk hover:underline font-medium block truncate text-sm"
                                >
                                    {/* Show placeholder if URL is '#' or invalid */}
                                    {(source.url && source.url !== '#') ? source.url : 'Source link unavailable'}
                                </a>
                                <p className="text-gray-400 text-xs mt-1 italic">"{source.snippet || 'No snippet provided'}"</p>
                                <span className="text-xs font-semibold bg-red-800/50 text-red-300 px-2 py-0.5 rounded-full mt-2 inline-block">
                  {source.matchPercent ? `${Math.round(source.matchPercent)}% Match` : 'Match % N/A'}
                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500 text-sm italic">No specific matching sources found by the API.</p>
                )}
            </div>
        </div>
    );
}

