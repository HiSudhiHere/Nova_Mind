console.log("✅ script.js loaded");

/* BACKEND URL */
const BACKEND_URL = "https://novamind-ujxn.onrender.com";


/* Elements */
const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");
const notesContainer = document.getElementById("notesContainer");
const askBtn = document.getElementById("askBtn");
const questionInput = document.getElementById("questionInput");
const aiResponse = document.getElementById("aiResponse");
const fileName = document.getElementById("fileName");
const downloadBtn = document.getElementById("downloadBtn");

/* ✅ NEW — store most recent AI reply */
let lastAnswer = "";

/* ============================================================
   ✅ SHOW SELECTED FILE NAME
============================================================ */
fileInput?.addEventListener("change", () => {
    fileName.textContent = fileInput.files.length > 0
        ? fileInput.files[0].name
        : "No file chosen";
});


/* ============================================================
   ✅ FORMAT NOTES → Headings, bullets, spacing
============================================================ */
function formatNotes(raw) {
    if (!raw) return "";

    let formatted = raw
        .replace(/^# (.*$)/gm, "<h2 class='collapsible'>$1</h2>")
        .replace(/\n- /g, "<br>• ")
        .replace(/\n• /g, "<br>• ")
        .replace(/\n\s*• /g, "<br>&nbsp;&nbsp;&nbsp;• ")
        .replace(/\n/g, "<br><br>");

    return formatted;
}


/* ============================================================
   ✅ MAKE COLLAPSIBLE SECTIONS
============================================================ */
function makeCollapsible() {
    const headers = document.querySelectorAll(".collapsible");

    headers.forEach(h => {
        if (h.dataset.bound) return;
        h.dataset.bound = "true";

        let next = h.nextElementSibling;
        let container = [];

        while (next && next.tagName !== "H2") {
            container.push(next);
            next = next.nextElementSibling;
        }

        let wrapper = document.createElement("div");
        wrapper.classList.add("note-section");
        container.forEach(item => wrapper.appendChild(item));

        h.insertAdjacentElement("afterend", wrapper);
        wrapper.style.display = "none";

        h.addEventListener("click", () => {
            wrapper.style.display =
                wrapper.style.display === "none" ? "block" : "none";
        });
    });
}


/* ============================================================
   ✅ HANDLE FILE UPLOAD → SEND TO BACKEND
============================================================ */
uploadBtn?.addEventListener("click", async (event) => {
    event.preventDefault();
    console.log("✅ Upload button clicked");

    const file = fileInput.files[0];
    if (!file) {
        alert("Please select a file first!");
        return;
    }

    let formData = new FormData();
    formData.append("file", file);

    notesContainer.innerHTML = "<p>Processing file...</p>";

    try {
        const res = await fetch(`${BACKEND_URL}/upload`, {
            method: "POST",
            body: formData
        });

        const data = await res.json();
        console.log("✅ upload response:", data);

        if (data.notes) {
            let formatted = formatNotes(data.notes);
            notesContainer.innerHTML = formatted;
            makeCollapsible();
        } else {
            notesContainer.innerHTML = "No notes found.";
        }

    } catch (err) {
        console.error("Upload error:", err);
        notesContainer.innerHTML = "<p>Error processing file.</p>";
    }
});


/* ============================================================
   ✅ HANDLE ASK QUESTION
============================================================ */
askBtn?.addEventListener("click", async () => {

    const question = questionInput.value.trim();
    if (!question) return;

    aiResponse.innerHTML = "<p>Thinking...</p>";

    try {
        const res = await fetch(`${BACKEND_URL}/ask`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question })
        });

        const data = await res.json();

        if (data.answer) {
            lastAnswer = data.answer;   // ✅ new store
            aiResponse.innerHTML = `<p>${formatNotes(data.answer)}</p>`;
        } else {
            aiResponse.innerHTML = "<p>No answer found.</p>";
        }

    } catch (err) {
        console.error("Ask error:", err);
        aiResponse.innerHTML = "<p>Error getting answer.</p>";
    }
});


/* ============================================================
   ✅ DOWNLOAD NOTES AS PDF
============================================================ */
downloadBtn?.addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let text = notesContainer.innerText;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    const maxWidth = pageWidth - margin * 2;

    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, margin, 10);

    doc.save("NovaMind_Notes.pdf");
});

if (data.answer) {
    lastAnswer = data.answer;   // <-- store new answer
    aiResponse.innerHTML = `<p>${formatNotes(data.answer)}</p>`;
}


/* ============================================================
   ✅ TEXT-TO-SPEECH — TOGGLE PLAY / STOP
============================================================ */
let speaking = false;
let utterance = null;

aiBubble?.addEventListener("click", () => {
    const text = aiResponse.innerText.trim();
    if (!text) {
        alert("No response to speak yet.");
        return;
    }

    // If already speaking → STOP
    if (speaking) {
        window.speechSynthesis.cancel();
        speaking = false;
        aiBubble.classList.remove("speaking");
        return;
    }

    // START speaking
    utterance = new SpeechSynthesisUtterance(text);

    speaking = true;
    aiBubble.classList.add("speaking");

    utterance.onend = () => {
        speaking = false;
        aiBubble.classList.remove("speaking");
    };

    window.speechSynthesis.speak(utterance);
});


/* ============================================================
   ✅ SPEECH-TO-TEXT
============================================================ */
const micBtn = document.getElementById("micBtn");

let recognition;
if ("webkitSpeechRecognition" in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
        micBtn.classList.add("recording");
    };

    recognition.onend = () => {
        micBtn.classList.remove("recording");
    };

    recognition.onresult = (event) => {
        let transcript = event.results[0][0].transcript;
        questionInput.value = transcript;
    };
} else {
    console.warn("Speech Recognition not supported.");
}

micBtn?.addEventListener("click", () => {
    if (recognition) recognition.start();
});