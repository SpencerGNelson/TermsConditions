document.querySelector('#summarizeButton').addEventListener('click', summarizeTerms);
const CONFIG = {
    API_BASE_URL: "http://localhost:8000",
    API_TIMEOUT_MS: 30000,
    MAX_CONTENT_LENGTH: 4000,
    FETCH_PREFIX: "FETCH:"
}
function showError(message) {
    document.getElementById("loading").style.display = "none";
    document.getElementById("error").style.display = message;
    document.getElementById("error").style.display = "block";
}
// Comprehensive keyword list for T&C variations
//3-21 to be used for potential future use outside of content scripts
const tcConfig = {
    keywords: [
        "terms of service",
        "terms and conditions",
        "terms of use",
        "user agreement",
        "service agreement",
        "eula",
        "tos"
    ],
    negativeKeywords: ["privacy", "cookie", "gdpr", "ccpa"]
}

tcConfig.urlPatterns = {
    exact: tcConfig.keywords.map(k => k.toLowerCase().replace(/\s+/g, '-')),
    partial: ["terms", "tos", "agreement", "eula"]
};

tcConfig.textRegex = new RegExp(tcConfig.keywords.join("|"), "i");

async function summarizeTerms() {
    console.log("Starting summarization");
    document.getElementById("loading").style.display = "block";
    document.getElementById("error").style.display = "none";
    document.getElementById("summary").value = "";

    try {
        // Check if user provided a T&C URL
        const tcUrl = document.getElementById("tcUrl").value;
        let text = "";
        let source = "manual";
        const parser = new DOMParser();


        if (tcUrl) { 
            // Fetch T&C page content
            try {
                new URL(tcUrl);
            } catch {
                throw new Error("Invalid URL format. Please enter a valid URL.");
            }
            const response = await fetch(tcUrl);
            const html = await response.text();
            const doc = parser.parseFromString(html, "text/html");
            text = extractTermsText(doc, { fetchPrefix: CONFIG.FETCH_PREFIX, maxLength: CONFIG.MAX_CONTENT_LENGTH});
            source = "manual URL";
        } else {
            // Get text from active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: extractTermsText,
                args:  [null, { fetchPrefix: CONFIG.FETCH_PREFIX, maxLength: CONFIG.MAX_CONTENT_LENGTH}]
            });
            text = response[0].result.text;
            source = response[0].result.source;

            if (text.startsWith(CONFIG.FETCH_PREFIX)) {
                const linkUrl = text.substring(CONFIG.FETCH_PREFIX.length);
                const linkResponse = await fetch(linkUrl);
                const linkHtml = await linkResponse.text();
                const linkDoc = parser.parseFromString(linkHtml, "text/html");

                // Try to find main content container
                let mainContent = linkDoc.querySelector('article, main, [role="main"], .main-content, #main-content, .post-content, .entry-content');

                if (mainContent) {
                    text = mainContent.innerText.substring(0, CONFIG.MAX_CONTENT_LENGTH);
                } else {
                    // Fallback: get paragraphs, excluding header/footer/nav
                    const allParagraphs = Array.from(linkDoc.querySelectorAll('p'));
                    const contentParagraphs = allParagraphs.filter(p => {
                        // Exclude if inside header/footer/nav
                        if (p.closest('header, footer, nav')) return false;
                        // Exclude very short paragraphs (likely menu items)
                        if (p.innerText.trim().length < 50) return false;
                        return true;
                    });
                    text = contentParagraphs.map(p => p.innerText).join('\n').substring(0, CONFIG.MAX_CONTENT_LENGTH);
                }

                source = `linked page: ${linkUrl}`;
            }

            if (!text) {
                throw new Error("No Terms & Conditions content found");
            }
        }

        if (!text) {
            throw new Error("No Terms & Conditions content found");
        }

        // Send text to backend
        //step 3
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT_MS);

        let apiResponse;
        try {
            const apiResponse = await fetch(`${CONFIG.API_BASE_URL}/summarize`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text })
             });
             clearTimeout(timeoutId);
        } catch {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error("Request timed out. The server may be busy or unavailable");
            }
            throw error;
        }
            
            // step 4
        if (!apiResponse.ok) {
            if (apiResponse.status === 404) {
                throw new Error("API endpoint not found. Check server configuration");
            }
            if (apiResponse.status >= 500) {
                throw new Error(`Server error (${apiResponse.status}). Please try again later.`);
            }
            throw new Error(`Request  failed with status ${apiResponse.status}`);
        }
        const data = await apiResponse.json();

        // Display result or error
        document.getElementById("loading").style.display = "none";
        if (data.error) {
           showError(data.error);
        } else {
            document.getElementById("summary").value = `Source: ${source}\n\n${data.summary}`;
        }
    } catch (error) {
        if (error.name === 'AbortError') {
        showError(`Error: ${error.message}`)
        }
        if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
            throw new Error("Cannot connect to server. Is the backend running?"); //3-05-26 system is crashing at this error
        }
        throw error;
    }

}

function extractTermsText(doc, config) {
    doc = doc || document;
    config = config || { fetchPrefix: "FETCH:", maxLength: 4000 };    // Inline config (self-contained for content script injection)
    const tcConfig = {
        keywords: [
            "terms of service",
            "terms and conditions",
            "terms of use",
            "user agreement",
            "service agreement",
            "eula",
            "tos"
        ],
        negativeKeywords: ["privacy", "cookie", "gdpr", "ccpa"]
    };

    tcConfig.urlPatterns = {
        exact: tcConfig.keywords.map(k => k.toLowerCase().replace(/\s+/g, '-')),
        partial: ["terms", "tos", "agreement", "eula"]
    };

    // Inline URL analyzer function
    function analyzeUrlForTC(url) {
        if (!url) return 0;

        const urlLower = url.toLowerCase();
        let score = 0;

        for (const pattern of tcConfig.urlPatterns.exact) {
            const regex = new RegExp(`\\/${pattern}(\\.html|\\.htm|\\.php|\\.aspx?)?$`, 'i');
            if (regex.test(urlLower)) {
                score += 8;
                break;
            }
        }

        if (score === 0) {
            for (const pattern of tcConfig.urlPatterns.partial) {
                if (urlLower.includes(`/${pattern}`) || urlLower.includes(`/${pattern}-`)) {
                    score += 5;
                    break;
                }
            }
        }

        for (const keyword of tcConfig.negativeKeywords) {
            if (urlLower.includes(keyword)) {
                score -= 5;
                break;
            }
        }

        return score;
    }

    // Heuristic scoring for T&C content
    const candidates = [];
    const footer = doc.querySelector("footer");

    // Check footer for links first
    if (footer) {
        const links = footer.querySelectorAll("a");
        for (const link of links) {
            const linkText = link.innerText.toLowerCase();
            const href = link.href.toLowerCase();
            let score = 0;
            score += analyzeUrlForTC(link.href);

            for (const keyword of tcConfig.keywords) {
                if (linkText.includes(keyword)) {
                    score += 10;
                    break;
                }
            }
            if (score > 0) {
                candidates.push({ type: "link", element: link, score, href: link.href });
            }
        }
        // Check footer for embedded text
        const textElements = footer.querySelectorAll("p, div, section");
        for (const element of textElements) {
            const elementText = element.innerText.toLowerCase();
            let score = 0;
            for (const keyword of tcConfig.keywords) {
                if (elementText.includes(keyword)) {
                    score += 2;
                }
            };
            if (score > 0) {
                candidates.push({ type: "text", element, score, text: element.innerText.trim() });
            }
        }
    }

    // Fallback: check entire page for links and text
    const allLinks = doc.querySelectorAll("a");
    for (const link of allLinks) {
        const linkText = link.innerText.toLowerCase();
        let score = 0;

        // URL pattern analysis
        score += analyzeUrlForTC(link.href);

        // Text-based keyword matching (lower confidence than footer)
        for (const keyword of tcConfig.keywords) {
            if (linkText.includes(keyword)) {
                score += 3;  // Lower confidence for page-wide links
                break;
            }
        }

        if (score > 0 && !footer?.contains(link)) {
            candidates.push({ type: "link", element: link, score, href: link.href });
        }
    }
    const allTextElements = doc.querySelectorAll("article, main, p");
    for (const element of allTextElements) {
        const elementText = element.innerText.toLowerCase();
        let score = 0;
        for (const keyword of tcConfig.keywords) {
            if (elementText.includes(keyword)) {
                score += 1;
            }
        };
        if (score > 0 && !footer?.contains(element)) {
            candidates.push({ type: "text", element, score, text: element.innerText.trim() });
        }
    }

    // Select highest-scoring candidate
    if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        const bestCandidate = candidates[0];
        if (bestCandidate.type === "link") {
            // Indicate link for fetching (handled in summarizeTerms)
            return { text: `${config.fetchPrefix}${bestCandidate.href}`, source: "footer link" };
        }
        return { text: bestCandidate.text.substring(0, config.maxLength), source: "footer text" };
    }

    // Fallback: return empty with page-wide source
    return { text: "", source: "page-wide search" };
}

