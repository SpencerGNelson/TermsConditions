import os
import google.generativeai as genai

gemini_key = os.getenv('GEMINI_API_KEY')

genai.configure(api_key=gemini_key)

model = genai.GenerativeModel('gemini-1.5-flash')