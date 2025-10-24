import React, { useState, useRef } from 'react';

// --- Constants ---
const AI_DETECTOR_TAB = 'ai';
const PLAGIARISM_CHECKER_TAB = 'plagiarism';
// --- NEW: Define Paraphrase Styles ---
const PARAPHRASE_STYLES = [
    { id: 'default', label: 'Standard' },
    { id: 'formal', label: 'Formal' },
    { id: 'casual', label: 'Casual' },
    { id: 'simple', label: 'Simple' },
];

// --- Main App Component ---
export default function App() {
    const [activeTab, setActiveTab] = useState(AI_DETECTOR_TAB);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [aiResult, setAiResult] = useState(null);
    const [plagiarismResult, setPlagiarismResult] = useState(null);
    const inputRef = useRef(null);
    const [highlightedContent, setHighlightedContent] = useState('');
    const [isParaphrasing, setIsParaphrasing] = useState(false);
    const [paraphraseError, setParaphraseError] = useState(null);
    // --- NEW: State for selected paraphrase style ---
    const [selectedParaphraseStyle, setSelectedParaphraseStyle] = useState('default');


    // --- API Call: AI Detector (Unchanged) ---
    const callGeminiApi = async (text, retries = 3, delay = 1000) => {
        // ... (keep existing callGeminiApi code) ...
        const payload = { contents: [{ parts: [{ text: text }] }] };
        try {
            // Assuming /api/check-ai endpoint exists and is configured correctly
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
            // Basic retry logic for rate limiting (429 status)
            if (retries > 0 && err.message.includes("429")) { await new Promise(res => setTimeout(res, delay)); return callGeminiApi(text, retries - 1, delay * 2); }
            else { console.error("AI Detector API Call Error:", err); throw err; } // Rethrow other errors
        }
    };

    // --- API Call: Paraphrase Text (UPDATED to send style) ---
    const callParaphraseApi = async (textToParaphrase, style, retries = 3, delay = 1000) => { // Added 'style' parameter
        try {
            // Assuming /api/paraphrase-text endpoint exists and is configured correctly
            const response = await fetch('/api/paraphrase-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Send both text and style
                body: JSON.stringify({ textToParaphrase, style })
            });
            if (!response.ok) { let errorBody; try { errorBody = await response.json(); } catch (e) { errorBody = { error: await response.text() }; } if (response.status === 400 && errorBody.error && errorBody.error.includes("blocked")) { throw new Error(errorBody.error); } throw new Error(errorBody.error || `API Error: ${response.status}`); }
            const result = await response.json();
            if (result && result.paraphrasedText) { return result.paraphrasedText; } // Expecting { paraphrasedText: "..." }
            else { console.error("Unexpected paraphrase response:", result); throw new Error("Failed to get paraphrased text."); }
        } catch (err) {
            // Basic retry logic for rate limiting
            if (retries > 0 && err.message.includes("429")) { await new Promise(res => setTimeout(res, delay)); return callParaphraseApi(textToParaphrase, style, retries - 1, delay * 2); } // Pass style on retry
            else { console.error("Paraphrase API Error:", err); throw err; } // Rethrow other errors
        }
    };

    // --- API Call: Plagiarism Checker (Unchanged) ---
    const callPlagiarismApi = async (textToCheck, retries = 3, delay = 1000) => {
        // ... (keep existing callPlagiarismApi code) ...
        try {
            // Assuming /api/check-plagiarism endpoint exists and is configured correctly
            const response = await fetch('/api/check-plagiarism', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ textToCheck }) });
            if (!response.ok) { let errorBody; try { errorBody = await response.json(); } catch (e) { errorBody = { error: await response.text() }; } throw new Error(errorBody.error || `API Error: ${response.status}`); }
            const result = await response.json();
            // Expecting { plagiarismScore: number, sources: array }
            if (result && typeof result.plagiarismScore !== 'undefined' && Array.isArray(result.sources)) { return result; }
            else { console.error("Unexpected plagiarism response structure:", result); throw new Error("Invalid response from plagiarism checker backend."); }
        } catch (err) {
            // Basic retry logic
            if (retries > 0 && err.message.includes("429")) { await new Promise(res => setTimeout(res, delay)); return callPlagiarismApi(textToCheck, retries - 1, delay * 2); }
            else { console.error("Plagiarism Check API Error:", err); throw err; } // Rethrow
        }
    };

    // --- Helper to escape Regex characters (Unchanged) ---
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // --- Highlighting Function (Unchanged logic) ---
    const generateHighlightedHtml = (originalText, highConfidence = [], mediumConfidence = []) => {
        let highlightedText = originalText;
        // Basic sanitization
        highlightedText = highlightedText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        // Convert newlines to <br> for HTML display
        highlightedText = highlightedText.replace(/\n/g, '<br />');

        const highSentences = Array.isArray(highConfidence) ? highConfidence : [];
        const mediumSentences = Array.isArray(mediumConfidence) ? mediumConfidence : [];

        // Apply high confidence highlights first
        if (highSentences.length > 0) {
            highSentences.forEach(sentence => {
                // Sanitize sentence before using in regex
                const sanitizedSentence = sentence.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                try {
                    const regex = new RegExp(escapeRegExp(sanitizedSentence), 'g');
                    highlightedText = highlightedText.replace(regex, `<mark class="ai-highlight-high">$&</mark>`);
                } catch (e) { console.error("Regex error (high confidence):", sentence, e); } // Log regex errors
            });
        }

        // Apply medium confidence highlights, avoiding nesting inside high highlights
        if (mediumSentences.length > 0) {
            let processedText = '';
            // Split by high highlights to process segments separately
            const segments = highlightedText.split(/(<mark class="ai-highlight-high">.*?<\/mark>)/);

            segments.forEach((segment) => {
                // If it's not already a high-highlighted part
                if (!segment.startsWith('<mark class="ai-highlight-high">')) {
                    let currentSegment = segment;
                    mediumSentences.forEach(sentence => {
                        // Sanitize sentence
                        const sanitizedSentence = sentence.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        try {
                            const regex = new RegExp(escapeRegExp(sanitizedSentence), 'g');
                            // Replace within this non-highlighted segment
                            currentSegment = currentSegment.replace(regex, `<mark class="ai-highlight-medium">$&</mark>`);
                        } catch (e) { console.error("Regex error (medium confidence):", sentence, e); }
                    });
                    processedText += currentSegment; // Add processed segment
                } else {
                    processedText += segment; // Add the high-highlighted part back untouched
                }
            });
            highlightedText = processedText;
        }
        return highlightedText;
    };


    // --- Event Handlers ---
    const handleSubmit = async () => {
        let currentText = '';
        if (inputRef.current) {
            // Get text from the correct element (div or textarea)
            currentText = inputRef.current.tagName === 'TEXTAREA' ? inputRef.current.value : inputRef.current.innerText;
        } else {
            currentText = inputText; // Fallback if ref not ready yet
        }

        if (!currentText || !currentText.trim()) {
            setError("Please enter some text to check.");
            setHighlightedContent(generateHighlightedHtml('', [], [])); // Clear highlights
            return;
        }

        // Reset states before making API call
        setIsLoading(true);
        setError(null);
        setParaphraseError(null);
        setAiResult(null);
        setPlagiarismResult(null);
        // Show plain text version in the div while loading
        setHighlightedContent(generateHighlightedHtml(currentText, [], []));

        try {
            if (activeTab === AI_DETECTOR_TAB) {
                const result = await callGeminiApi(currentText);
                setAiResult(result);
                // Generate highlighted HTML based on API response
                const html = generateHighlightedHtml(
                    currentText,
                    result.highConfidenceSentences, // Use the correct field names from API response
                    result.mediumConfidenceSentences
                );
                setHighlightedContent(html);
            } else if (activeTab === PLAGIARISM_CHECKER_TAB) {
                const result = await callPlagiarismApi(currentText);
                setPlagiarismResult(result);
                // Plagiarism check doesn't highlight, keep plain HTML
                const html = generateHighlightedHtml(currentText, [], []);
                setHighlightedContent(html);
            }
        } catch (err) {
            // Display error to the user
            setError(`Analysis failed: ${err.message}. Please check input or try again.`);
            // Ensure the input text is still displayed (as plain HTML) on error
            const html = generateHighlightedHtml(currentText, [], []);
            setHighlightedContent(html);
        } finally {
            setIsLoading(false); // Stop loading indicator
        }
    };

    // --- UPDATED Paraphrase Handler (Passes style) ---
    const handleParaphraseClick = async () => {
        let textToParaphrase = '';
        if (inputRef.current) {
            // IMPORTANT: Use innerText to get text *without* existing HTML highlights
            textToParaphrase = inputRef.current.innerText;
        }
        if (!textToParaphrase || textToParaphrase.trim() === '') {
            setParaphraseError("No text available to paraphrase.");
            return;
        }

        setIsParaphrasing(true);
        setParaphraseError(null);
        setError(null); // Clear analysis errors too

        try {
            // Pass the currently selected style state to the API call
            const paraphrased = await callParaphraseApi(textToParaphrase, selectedParaphraseStyle);

            // Update the display with the NEW paraphrased text (no highlights)
            setHighlightedContent(generateHighlightedHtml(paraphrased, [], []));
            // Update the underlying inputText state as well
            setInputText(paraphrased);

            // Clear previous analysis results as they are no longer valid
            setAiResult(null);
            setPlagiarismResult(null);

        } catch(err) {
            setParaphraseError(`Paraphrasing failed: ${err.message}`);
        } finally {
            setIsParaphrasing(false);
        }
    };


    const handleTabChange = (tab) => {
        setActiveTab(tab);
        // Clear results and errors when changing tabs
        setAiResult(null);
        setPlagiarismResult(null);
        setError(null);
        setParaphraseError(null);
        setIsLoading(false);
        setIsParaphrasing(false);

        // Keep the current text, but remove highlights
        let currentText = '';
        if (inputRef.current) {
            // Get text from the current element (div or textarea)
            currentText = inputRef.current.tagName === 'TEXTAREA' ? inputRef.current.value : inputRef.current.innerText;
        } else {
            currentText = inputText; // Fallback
        }
        // Update display to show plain text version
        setHighlightedContent(generateHighlightedHtml(currentText, [], []));
    };

    // Determine if there is *any* result currently displayed
    const hasResult = aiResult || plagiarismResult;

    // --- Render ---
    return (
        // Main container
        <div className="flex justify-center items-start min-h-screen bg-gray-900 font-sans p-4 pt-10">
            {/* Card container - width adjusts based on whether results are shown */}
            <div className={`w-full ${hasResult ? 'max-w-6xl' : 'max-w-2xl'} bg-gray-blue rounded-xl shadow-2xl overflow-hidden my-8 transition-all duration-500 ease-in-out`}>
                {/* Header */}
                <header className="p-6">
                    <h1 className="text-3xl font-bold text-white text-center">OriCheck</h1>
                    <p className="text-gray-400 text-center mt-1">Check AI generation and potential plagiarism.</p>
                </header>
                {/* Tab Navigation */}
                <nav className="flex bg-gray-blue/50 border-b border-gray-700">
                    <TabButton title="AI Detector" isActive={activeTab === AI_DETECTOR_TAB} onClick={() => handleTabChange(AI_DETECTOR_TAB)} />
                    <TabButton title="Plagiarism Checker" isActive={activeTab === PLAGIARISM_CHECKER_TAB} onClick={() => handleTabChange(PLAGIARISM_CHECKER_TAB)} />
                </nav>

                {/* --- Main Content Grid (1 or 2 columns) --- */}
                <div className={`grid ${hasResult ? 'grid-cols-1 md:grid-cols-2 gap-x-8' : 'grid-cols-1'} transition-all duration-500 ease-in-out`}>

                    {/* --- Column 1: Text Input Area --- */}
                    <div className="p-6 md:p-8 flex flex-col">
                        {/* Input Element: Switches between DIV (for results/highlights) and TEXTAREA (for initial input) */}
                        {hasResult || highlightedContent ? (
                            // Display as a non-editable DIV when there are results or highlighted content
                            <div
                                ref={inputRef} // Assign ref to the div
                                className="w-full h-96 p-4 border border-gray-700 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-milk overflow-y-auto flex-grow prose prose-invert max-w-none prose-mark:p-0 prose-mark:rounded-none prose-mark:bg-opacity-100"
                                // Render the HTML content with highlights
                                dangerouslySetInnerHTML={{ __html: highlightedContent || generateHighlightedHtml(inputText, [], []) }}
                                contentEditable={false} // Make it read-only after analysis/paraphrase
                                suppressContentEditableWarning={true}
                            />
                        ) : (
                            // Display as a TEXTAREA initially or after clearing results
                            <textarea
                                ref={inputRef} // Assign ref to the textarea
                                className="w-full h-96 p-4 border border-gray-700 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-milk resize-none placeholder-gray-500 flex-grow"
                                placeholder={ activeTab === AI_DETECTOR_TAB ? "Paste text here to check for AI generation..." : "Paste text here to check for plagiarism..." }
                                value={inputText} // Controlled component
                                onChange={(e) => { setInputText(e.target.value); }} // Update state on change
                                disabled={isLoading || isParaphrasing} // Disable while loading
                            />
                        )}

                        {/* Highlight Legend (only shown on AI tab when results exist) */}
                        {activeTab === AI_DETECTOR_TAB && hasResult && aiResult && ( <HighlightLegend /> )}

                        {/* Analyze Button */}
                        <button
                            onClick={handleSubmit}
                            disabled={isLoading || isParaphrasing}
                            className="w-full mt-4 p-4 bg-milk text-gray-blue font-semibold rounded-lg shadow-md hover:bg-opacity-90 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                        >
                            {isLoading ? <Spinner text="Analyzing..." /> : 'Analyze Text'}
                        </button>
                        {/* Error Displays */}
                        {error && ( <div className="mt-2 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-lg text-sm">{error}</div> )}
                        {paraphraseError && ( <div className="mt-2 p-3 bg-yellow-900/50 border border-yellow-700 text-yellow-300 rounded-lg text-sm">{paraphraseError}</div> )}
                    </div>

                    {/* --- Column 2: Results Area (Conditionally Rendered) --- */}
                    {hasResult && (
                        <div className="p-6 md:p-8 border-t md:border-t-0 md:border-l border-gray-700">
                            {/* Loading indicator for results column */}
                            {(isLoading || isParaphrasing) && ( <div className="text-center text-gray-400 h-full flex items-center justify-center">{isParaphrasing ? 'Paraphrasing...' : 'Checking...'}</div> )}
                            {/* Display AI results if not loading and AI tab is active */}
                            {!isLoading && !isParaphrasing && activeTab === AI_DETECTOR_TAB && aiResult && (
                                <AiResultDisplay
                                    result={aiResult}
                                    onParaphraseClick={handleParaphraseClick}
                                    isParaphrasing={isParaphrasing}
                                    selectedStyle={selectedParaphraseStyle} // Pass current style
                                    onStyleChange={setSelectedParaphraseStyle} // Pass function to update style
                                />
                            )}
                            {/* Display Plagiarism results if not loading and Plagiarism tab is active */}
                            {!isLoading && !isParaphrasing && activeTab === PLAGIARISM_CHECKER_TAB && plagiarismResult && (
                                <PlagiarismResultDisplay result={plagiarismResult} />
                            )}
                        </div>
                    )}
                </div> {/* End Grid */}
            </div> {/* End Card */}
        </div> // End Main Container
    );
}

// --- Helper Components ---

// Legend for AI highlighting colors
function HighlightLegend() {
    return (
        <div className="mt-3 text-xs text-gray-400 highlight-legend flex items-center space-x-4">
            <span className="font-medium">Key:</span>
            <div className="flex items-center">
                <span style={{ backgroundColor: '#FFFFFF', color: '#2b323f', padding: '1px 4px', borderRadius: '3px', marginRight: '5px', fontWeight: '500' }}>White</span>
                <span className="text-gray-400">- High AI Confidence</span>
            </div>
            <div className="flex items-center">
                <span style={{ backgroundColor: '#4b5563', color: '#FDFDF1', padding: '1px 4px', borderRadius: '3px', marginRight: '5px' }}>Grey</span>
                <span className="text-gray-400">- Medium AI Confidence</span>
            </div>
        </div>
    );
}

// Tab button component
function TabButton({ title, isActive, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 py-4 px-2 font-medium text-center transition-all duration-200 outline-none ${
                isActive
                    ? 'border-b-4 border-milk text-milk' // Style for active tab
                    : 'text-gray-400 hover:bg-gray-700/30 hover:text-gray-200' // Style for inactive tab
            }`}
        >
            {title}
        </button>
    );
}

// Loading spinner component
function Spinner({ text = "" }) {
    return (
        <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {text && <span>{text}</span>} {/* Display optional text next to spinner */}
        </>
    );
}

// Component to display AI detection results and paraphrase options
function AiResultDisplay({ result, onParaphraseClick, isParaphrasing, selectedStyle, onStyleChange }) {
    // Calculate score and determine color/confidence level
    const score = result ? Math.round(result.aiScore) : 0;
    const color = score > 75 ? 'text-red-400' : score > 40 ? 'text-yellow-400' : 'text-green-400';
    const confidence = score > 75 ? 'High Confidence' : score > 40 ? 'Medium Confidence' : 'Low Confidence';
    // Check if any sentences were detected
    const sentencesDetected = result && (
        (Array.isArray(result.highConfidenceSentences) && result.highConfidenceSentences.length > 0) ||
        (Array.isArray(result.mediumConfidenceSentences) && result.mediumConfidenceSentences.length > 0)
    );
    // Determine if the paraphrase button should be shown (e.g., score > 10%)
    const showParaphraseButton = score > 10;

    return (
        // Container for AI results
        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 animate-fade-in h-full flex flex-col justify-between">
            {/* Top section: Score, Justification */}
            <div>
                <h3 className="text-xl font-semibold text-white mb-4 text-center">AI Detection Result</h3>
                {/* Score display */}
                <div className="flex items-center justify-center space-x-4 mb-4">
                    <div className={`text-6xl font-bold ${color}`}>{score}%</div>
                    <div className="text-lg text-center">
                        <div className="font-semibold text-gray-200">Likely AI-Generated</div>
                        <div className={`text-sm ${color}`}>{confidence}</div>
                    </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden mb-4">
                    <div
                        className={`h-4 rounded-full transition-all duration-500 ease-in-out ${
                            score > 75 ? 'bg-red-500' : score > 40 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${score}%` }}
                    ></div>
                </div>
                {/* Justification text */}
                <div>
                    <h4 className="font-semibold text-gray-200">Justification:</h4>
                    <p className="text-gray-400 italic text-sm">"{result?.justification || 'N/A'}"</p>
                </div>
                {/* Info about highlighting */}
                <div className="mt-4 text-sm text-gray-500 text-center">
                    {sentencesDetected ? 'Highlighted sentences shown in the text input.' : 'No specific AI sentences detected.'}
                </div>
            </div>

            {/* Bottom section: Paraphrase options (conditionally rendered) */}
            {showParaphraseButton && (
                <div className="mt-6 border-t border-gray-700 pt-4">
                    <p className="text-xs text-gray-400 mb-2 text-center font-medium">Humanize Text (Beta):</p>
                    {/* Style Selection Buttons */}
                    <div className="flex flex-wrap justify-center gap-2 mb-3">
                        {PARAPHRASE_STYLES.map(style => (
                            <button
                                key={style.id}
                                onClick={() => onStyleChange(style.id)} // Update selected style on click
                                disabled={isParaphrasing} // Disable while paraphrasing
                                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors duration-200 ${
                                    selectedStyle === style.id
                                        ? 'bg-milk text-gray-blue ring-1 ring-milk' // Active style button
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600' // Inactive style button
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {style.label}
                            </button>
                        ))}
                    </div>
                    {/* Paraphrase Button */}
                    <button
                        onClick={onParaphraseClick} // Trigger paraphrase action
                        disabled={isParaphrasing} // Disable while paraphrasing
                        className="w-full p-3 bg-gray-600 text-milk font-medium rounded-lg shadow-sm hover:bg-gray-500 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                    >
                        {/* Show spinner or button text */}
                        {isParaphrasing ? <Spinner text="Paraphrasing..." /> : `Paraphrase (${PARAPHRASE_STYLES.find(s => s.id === selectedStyle)?.label || 'Standard'})`}
                    </button>
                    {/* Disclaimer */}
                    <p className="text-[10px] text-gray-500 mt-1 text-center">Attempts to humanize using varied sentences & simpler words. Review carefully. AI score reduction not guaranteed.</p>
                </div>
            )}
        </div>
    );
}


// Component to display plagiarism check results
function PlagiarismResultDisplay({ result }) {
    // Calculate score and determine color/match level
    const score = result ? Math.round(result.plagiarismScore) : 0;
    const color = score > 15 ? 'text-red-400' : score > 5 ? 'text-yellow-400' : 'text-green-400';
    const matchLevel = score > 15 ? 'High Match' : score > 5 ? 'Possible Match' : 'Likely Original';
    // Check if sources were found
    const hasSources = result?.sources && result.sources.length > 0;

    return (
        // Container for plagiarism results
        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 animate-fade-in h-full flex flex-col">
            <h3 className="text-xl font-semibold text-white mb-4 text-center">Plagiarism Check Result</h3>
            {/* Score display */}
            <div className="flex items-center justify-center space-x-4 mb-4">
                <div className={`text-6xl font-bold ${color}`}>{score}%</div>
                <div className="text-lg text-center">
                    <div className="font-semibold text-gray-200">Potential Plagiarism</div>
                    <div className={`text-sm ${color}`}>{matchLevel}</div>
                </div>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden mb-4">
                <div
                    className={`h-4 rounded-full transition-all duration-500 ease-in-out ${
                        score > 15 ? 'bg-red-500' : score > 5 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${score}%` }}
                ></div>
            </div>
            {/* Matched Sources section */}
            <div className="mt-6 flex-grow overflow-y-auto"> {/* Allows scrolling if list is long */}
                <h4 className="font-semibold text-gray-200 mb-2">Matched Sources:</h4>
                {hasSources ? (
                    // List of sources
                    <ul className="space-y-3">
                        {result.sources.map((source, index) => (
                            <li key={index} className="border border-gray-700 p-3 rounded-lg bg-gray-800">
                                {/* Source URL Link */}
                                <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-milk hover:underline font-medium block truncate text-sm"
                                >
                                    {/* Display URL or placeholder */}
                                    {(source.url && source.url !== '#') ? source.url : 'Source link unavailable'}
                                </a>
                                {/* Snippet of matched text */}
                                <p className="text-gray-400 text-xs mt-1 italic">"{source.snippet || 'No snippet provided'}"</p>
                                {/* Match percentage */}
                                <span className="text-xs font-semibold bg-red-800/50 text-red-300 px-2 py-0.5 rounded-full mt-2 inline-block">
                                    {source.matchPercent ? `${Math.round(source.matchPercent)}% Match` : 'Match % N/A'}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    // Message if no sources found
                    <p className="text-gray-500 text-sm italic">No specific matching sources found by the API.</p>
                )}
            </div>
        </div>
    );
}

