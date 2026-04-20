from django.shortcuts import render
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view

from .url_finder import find_terms_url
from .gemini import summarize_terms

@api_view(['POST'])
def summarize(request):
    text = request.data.get('text')
    if text:
        summarized_text = summarize_terms(text)
        return Response(summarized_text, status=status.HTTP_200_OK)

    return Response(status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
def search(request):
    company_name = request.data.get('company_name')
    if not company_name:
        return Response(status=status.HTTP_400_BAD_REQUEST)
    
    text = find_terms_url(company_name)
    if not text:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    summary = summarize_terms(text)
    return Response(summary, status=status.HTTP_200_OK)