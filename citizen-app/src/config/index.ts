// On Android emulator → 10.0.2.2 points to host machine localhost
// On iOS simulator   → localhost works
// On physical device → replace with your machine's local IP (e.g. 192.168.1.x)
export const API_URL = "http://10.0.2.2:8000";

// ArcGIS — used for basemap and routing only (read-only, safe to expose in app)
export const ARCGIS_API_KEY = "your_arcgis_api_key_here"; // Replace at build time
export const ARCGIS_FEATURE_SERVICE_URL = "https://services.arcgis.com/YOUR_ORG/arcgis/rest/services/MasterplanVelo/FeatureServer";

// Bucharest center
export const BUCHAREST_CENTER = { latitude: 44.4268, longitude: 26.1025 };
export const BUCHAREST_REGION = {
  latitude: 44.4268,
  longitude: 26.1025,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};
