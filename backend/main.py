from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline
import re

#uvicorn backend.main:app --reload --port 8000


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["POST"],
    allow_headers=["*"],
)

summarizer = pipeline("summarization", model="sshleifer/distilbart-cnn-12-6")

class TextInput(BaseModel):
    text: str

def preprocess_text(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)  
    text = re.sub(r"\s+", " ", text).strip()  
    return text[:4000] 
 
@app.post("/summarize")
async def summarize_text(input: TextInput):
    try:
        cleaned_text = preprocess_text(input.text)
        if not cleaned_text:
            return {"error": "No valid text provided"}

        summary = summarizer(cleaned_text, max_length=150, min_length=50, do_sample=False)
        return {"summary": summary[0]["summary_text"]}
    except Exception as e:
        return {"error": f"Summarization failed: {str(e)}"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}