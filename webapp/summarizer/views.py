from django.shortcuts import render
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view

from .url_finder import find_terms_url
from .gemini import summarize_terms
from .models import Summary

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
    
    cached = Summary.objects.filter(company_name=company_name).first()
    if cached:
        return Response({
            'data_collected': cached.data_collected,
            'third_party_sharing': cached.third_party_sharing,
            'your_rights': cached.your_rights,
            'cancellation_refund_policy': cached.cancellation_refund_policy,
            'red_flags': cached.red_flags,
        }, status=status.HTTP_200_OK)
    
    text = find_terms_url(company_name)
    if not text:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    summary = summarize_terms(text)
    Summary.objects.create(
        company_name=company_name,
        url='',
        data_collected=summary['data_collected'],
        third_party_sharing=summary['third_party_sharing'],
        your_rights=summary['your_rights'],
        cancellation_refund_policy=summary['cancellation_refund_policy'],
        red_flags=summary['red_flags'],
    )

    return Response(summary, status=status.HTTP_200_OK)