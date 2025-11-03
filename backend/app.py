"""
============================================================
NOVA MIND — BACKEND (Flask)
Optimized for:
- PDF text extraction
- Image OCR
- Topic-wise structured summarization
- Structured Q&A responses
============================================================
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pdfplumber

# ✅ ✅ REPLACES OPENAI
import google.generativeai as genai

from PIL import Image
import pytesseract
import os

# ✅ Update Tesseract path (Windows default)
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


# ============================================================
# ✅ CONFIG
# ============================================================

app = Flask(__name__)
CORS(app)

# ⚠️ REPLACE WITH YOUR GEMINI API KEY
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


# ✅ Load model
model = genai.GenerativeModel("models/gemini-2.5-flash")

# Stores extracted syllabus text
full_text = ""


# ============================================================
# ✅ Extract text from PDF
# ============================================================
def extract_text_from_pdf(file_path):
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text += t + "\n"
    except Exception as e:
        print("❌ PDF extract error:", e)
    return text.strip()


# ============================================================
# ✅ Extract text from Image (OCR)
# ============================================================
def extract_text_from_image(file_path):
    try:
        img = Image.open(file_path)
        text = pytesseract.image_to_string(img)
        return text.strip()
    except Exception as e:
        print("❌ OCR Error:", e)
        return ""


# ============================================================
# ✅ Chunk long text
# ============================================================
def chunk_text(text, max_chars=10000):
    chunks = []
    while len(text) > max_chars:
        chunks.append(text[:max_chars])
        text = text[max_chars:]
    chunks.append(text)
    return chunks


# ============================================================
# ✅ Summarize each chunk
# ============================================================
def summarize_chunks(chunks):
    summaries = []
    for i, chunk in enumerate(chunks):
        print(f"🧩 Processing chunk {i+1}/{len(chunks)}...")

        prompt = f"""
You are an expert educator.

Your job is to read the content below and produce NEW, SHORTER, high-quality study notes.

✅ STRICT RULES
- DO NOT repeat content word-for-word
- Summarize + reorganize
- Combine related points into topics
- Add missing structure (# headings)
- Keep bullets short
- Rewrite sentences into simpler language
- Add examples only when helpful
- Skip redundant details

✅ OUTPUT FORMAT
# Main Topic
## Subtopic
• Key point (short + simple)
    • subpoint (optional)

### Definitions
term — meaning

### Examples
• example

✅ CONTENT TO SUMMARIZE
{chunk}
"""

        try:
            response = model.generate_content(prompt)
            summary = response.text
            summaries.append(summary)

        except Exception as e:
            print("❌ Chunk failed:", e)
            summaries.append("")

    return "\n\n".join(summaries)


# ============================================================
# ✅ /upload → Generate topic-wise notes
# ============================================================
@app.route("/upload", methods=["POST"])
def upload_file():
    global full_text

    if "file" not in request.files:
        return jsonify({"error": "No file received"}), 400

    file = request.files["file"]

    file_ext = file.filename.lower()
    save_path = f"./uploaded.{file_ext.split('.')[-1]}"
    file.save(save_path)

    full_text = ""

    if file_ext.endswith(".pdf"):
        full_text = extract_text_from_pdf(save_path)

    elif file_ext.endswith((".png", ".jpg", ".jpeg", ".bmp", ".tiff")):
        full_text = extract_text_from_image(save_path)

    else:
        return jsonify({"error": "Unsupported file type"}), 400

    if not full_text.strip():
        return jsonify({"notes": "No readable text found."}), 200

    try:
        chunks = chunk_text(full_text)
        final_notes = summarize_chunks(chunks)
        print("✅ NOTES RESULT:", final_notes[:350], "...\n")
        return jsonify({"notes": final_notes})

    except Exception as e:
        print("❌ Summarization Error:", e)
        return jsonify({"error": str(e)}), 500


# ============================================================
# ✅ /ask → Ask a question about the uploaded content
# ============================================================
@app.route("/ask", methods=["POST"])
def ask_question():
    data = request.get_json()
    question = data.get("question", "")

    if not question:
        return jsonify({"error": "No question provided"}), 400

    if not full_text.strip():
        return jsonify({"error": "Please upload a file first."}), 400

    prompt = f"""
You are an AI teacher. Use the uploaded text to answer the question.

RULES:
1) Treat every question independently.
2) If question is related to the text → answer using it.
3) If unrelated → answer generically.
4) Keep answers short + clean + readable.
5) End with a brief summary.

TEXT:
{full_text[:10000]}

QUESTION:
{question}
"""

    try:
        response = model.generate_content(prompt)
        answer = response.text
        return jsonify({"answer": answer})

    except Exception as e:
        print("❌ Gemini Error:", e)
        return jsonify({"error": "AI failed"}), 500

@app.route("/")
def home():
    return "✅ NovaMind backend running!"

# ============================================================
# ✅ Main
# ============================================================
if __name__ == "__main__":
    print("\n✅ NovaMind Backend Running — http://localhost:5000")
    app.run(debug=True)
