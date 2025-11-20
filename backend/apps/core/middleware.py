"""
Middleware temporal para debug de requests
"""
import json
import logging

logger = logging.getLogger(__name__)

class RequestLoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == '/api/turnos/' and request.method == 'POST':
            try:
                body = json.loads(request.body.decode('utf-8'))
                logger.error(f"\n{'='*50}")
                logger.error(f"POST /api/turnos/")
                logger.error(f"Headers: {dict(request.headers)}")
                logger.error(f"Body: {json.dumps(body, indent=2)}")
                logger.error(f"{'='*50}\n")
                print(f"\n{'='*50}")
                print(f"POST /api/turnos/")
                print(f"Body: {json.dumps(body, indent=2)}")
                print(f"{'='*50}\n")
            except Exception as e:
                logger.error(f"Error logging request: {e}")

        response = self.get_response(request)
        
        if request.path == '/api/turnos/' and request.method == 'POST' and response.status_code >= 400:
            try:
                print(f"\n{'='*50}")
                print(f"RESPONSE ERROR:")
                print(f"Status: {response.status_code}")
                print(f"Content: {response.content.decode('utf-8')}")
                print(f"{'='*50}\n")
            except:
                pass

        return response
