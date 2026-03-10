import os
from dotenv import load_dotenv
load_dotenv()

ARCGIS_API_KEY = os.getenv("ARCGIS_API_KEY")
ARCGIS_FEATURE_SERVICE_URL = os.getenv("ARCGIS_FEATURE_SERVICE_URL")
ARCGIS_LANES_LAYER = os.getenv("ARCGIS_LANES_LAYER", "0")
ARCGIS_PARKING_LAYER = os.getenv("ARCGIS_PARKING_LAYER", "1")
ARCGIS_ISSUES_LAYER_URL = os.getenv("ARCGIS_ISSUES_LAYER_URL")
AI_ENGINE_URL = f"http://localhost:{os.getenv('AI_ENGINE_PORT', '8001')}"
