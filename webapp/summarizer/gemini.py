import os
import json
from google import genai

client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

def summarize_terms(text):
    prompt = f"""
    You are a legal document analyst.
    Analyze the Terms and Conditions text provided below and extract key information into specific categories.
    Return a JSON object using these exact keys: data_collected, third_party_sharing, your_rights, cancellation_refund_policy, and red_flags.
    Keep each field to a few concise bullet points and only return the JSON.
    Terms and Conditions: {text}
"""
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt
    )
    raw = response.text
    cleaned = raw.replace('```json', '').replace('```', '').strip()
    return json.loads(cleaned)
