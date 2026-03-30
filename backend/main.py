from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline
import re
import os
from dotenv import load_dotenv

#uvicorn backend.main:app --reload --port 8000
'''
load_dotenv()  # reads your .env file and loads the variables

api_key = os.getenv("ANTHROPIC_API_KEY")
api_secret = os.getenv("API_SECRET")
'''

app = FastAPI()

allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  
    allow_credentials=True,
    allow_methods=["POST"],
    allow_headers=["Content-Type","X-API-Key"],
)

summarizer = pipeline("summarization", model="nsi319/legal-led-base-16384")

class TextInput(BaseModel):
    text: str

def preprocess_text(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)  
    text = re.sub(r"\s+", " ", text).strip()  
    return text[:16000] 

def clean_summary(text: str) -> str:
    text = text.strip()

    if text and text[-1] not in '.!?':
        last_period = max(text.rfind('.'), text.rfind('!'), text.rfind('?'))
        if last_period > 0:
            text = text[:last_period + 1]
    
    return text.strip()

@app.post("/summarize")
async def summarize_text(input: TextInput):
    try:
        cleaned_text = preprocess_text(input.text)
        if not cleaned_text:
            return {"error": "No valid text provided"}

        print("=== INPUT TEXT ===")
        print(cleaned_text)
        print("=== END INPUT TEXT ===")

        summary = summarizer(cleaned_text,
            max_length=300,
            min_length=100,
            do_sample=True,
            repetition_penalty=2.5,
            length_penalty=1.0,
            num_beams=4,
            early_stopping=True,
            truncation=True)
        summary_text = summary[0]["summary_text"]
        summary_text = clean_summary(summary_text)
        return {"summary": summary_text}
    except Exception as e:
        return {"error": f"Summarization failed: {str(e)}"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}