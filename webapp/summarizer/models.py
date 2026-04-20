from django.db import models

class Summary(models.Model):
    company_name = models.CharField(max_length=225)
    url = models.CharField(max_length=500)
    data_collected = models.TextField()
    third_party_sharing = models.TextField()
    your_rights = models.TextField()
    cancellation_refund_policy = models.TextField()
    red_flags = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
