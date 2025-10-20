document.querySelector('#summarizeButton').addEventListener('click', summarizeTerms);
// Comprehensive keyword list for T&C variations
const tcKeywords = [
    "terms", "conditions", "terms of service", "terms of use", "user agreement",
    "legal", "policy", "contract", "tos", "t&c", "terms and conditions",
    "eula", "service agreement", "conditions of use", "user terms", "agreement"
];
const tcRegex = new RegExp(tcKeywords.join("|"), "i");

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

        if (tcUrl) {
            // Fetch T&C page content
            const response = await fetch(tcUrl);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            text = extractTermsText(doc);
            source = "manual URL";
        } else {
            // Get text from active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: extractTermsText
            });
            text = response[0].result.text;
            source = response[0].result.source;
        }

        if (!text) {
            throw new Error("No Terms & Conditions content found");
        }

        // Send text to backend
        const apiResponse = await fetch("/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
        });
        const data = await apiResponse.json();

        // Display result or error
        document.getElementById("loading").style.display = "none";
        if (data.error) {
            document.getElementById("error").textContent = data.error;
            document.getElementById("error").style.display = "block";
        } else {
            document.getElementById("summary").value = `Source: ${source}\n\n${data.summary}`;
        }
    } catch (error) {
        document.getElementById("loading").style.display = "none";
        document.getElementById("error").textContent = `Error: ${error.message}`;
        document.getElementById("error").style.display = "block";
    }
}

function extractTermsText(doc = document) {
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
            tcKeywords.forEach(keyword => {
                if (linkText.includes(keyword) || href.includes(keyword)) {
                    score += linkText.includes(keyword) ? 2 : 1;
                }
            });
            // Boost score if near other legal terms
            if (linkText.includes("privacy") || href.includes("privacy")) {
                score += 1;
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
            tcKeywords.forEach(keyword => {
                if (elementText.includes(keyword)) {
                    score += 2;
                }
            });
            if (score > 0) {
                candidates.push({ type: "text", element, score, text: element.innerText.trim() });
            }
        }
    }

    // Fallback: check entire page for links and text
    const allLinks = doc.querySelectorAll("a");
    for (const link of allLinks) {
        const linkText = link.innerText.toLowerCase();
        const href = link.href.toLowerCase();
        let score = 0;
        tcKeywords.forEach(keyword => {
            if (linkText.includes(keyword) || href.includes(keyword)) {
                score += linkText.includes(keyword) ? 1 : 0.5;
            }
        });
        if (score > 0 && !footer?.contains(link)) {
            candidates.push({ type: "link", element: link, score, href: link.href });
        }
    }
    const allTextElements = doc.querySelectorAll("article, main, p");
    for (const element of allTextElements) {
        const elementText = element.innerText.toLowerCase();
        let score = 0;
        tcKeywords.forEach(keyword => {
            if (elementText.includes(keyword)) {
                score += 1;
            }
        });
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
            return { text: `FETCH:${bestCandidate.href}`, source: "footer link" };
        }
        return { text: bestCandidate.text.substring(0, 4000), source: "footer text" };
    }

    // Fallback: return empty with page-wide source
    return { text: "", source: "page-wide search" };
}