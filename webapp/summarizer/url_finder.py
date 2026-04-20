import requests
from bs4 import BeautifulSoup
import re

def clean_company_name(company_name):
    lowercase_name = re.sub(r'[^a-z0-9]', '', company_name.lower())
    return lowercase_name

def fetch_text_from_url(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        response = requests.get(url, timeout=10, headers=headers)

        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            return soup.get_text()
        return None
    except:
        return None


def find_terms_url(company_name):
    clean_name = clean_company_name(company_name)

    urls = [
        f'https://www.{clean_name}.com/terms',
        f'https://www.{clean_name}.com/tos',
        f'https://www.{clean_name}.com/legal',
        f'https://www.{clean_name}.com/privacy',
    ]

    for url in urls:
        text = fetch_text_from_url(url)
        if text:
            return text
    
    return None