import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { BUCHAREST_REGION } from "../config";
import { getLanes, getOpenIssues } from "../api";

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [lanes, setLanes] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [reportMode, setReportMode] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation(location.coords);
      }
    })();
    loadMapData();
  }, []);

  async function loadMapData() {
    try {
      const [lanesRes, issuesRes] = await Promise.all([getLanes(), getOpenIssues()]);
      setLanes(lanesRes.data.features || []);
      setIssues(issuesRes.data.features || []);
    } catch (e) {
      console.error("Failed to load map data:", e);
    }
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={BUCHAREST_REGION}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {/* Bike lanes */}
        {lanes.map((feature: any, i: number) => {
          if (feature.geometry?.type !== "LineString") return null;
          const coords = feature.geometry.coordinates.map(([lng, lat]: number[]) => ({ latitude: lat, longitude: lng }));
          const color = feature.properties?.status === "active" ? "#22c55e"
            : feature.properties?.status === "planned" ? "#3b82f6" : "#f59e0b";
          return <Polyline key={i} coordinates={coords} strokeColor={color} strokeWidth={3} />;
        })}

        {/* Citizen issues */}
        {issues.map((feature: any, i: number) => {
          const [lng, lat] = feature.geometry.coordinates;
          return (
            <Marker key={i} coordinate={{ latitude: lat, longitude: lng }}
              pinColor={feature.properties.severity >= 4 ? "red" : "orange"}
              title={feature.properties.category}
              description={feature.properties.description}
            />
          );
        })}
      </MapView>

      {/* Report Issue FAB */}
      <TouchableOpacity
        style={[styles.fab, reportMode && styles.fabActive]}
        onPress={() => setReportMode(!reportMode)}
      >
        <Text style={styles.fabText}>{reportMode ? "✕ Cancel" : "⚠️ Report"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  fab: {
    position: "absolute", bottom: 32, right: 20,
    backgroundColor: "#ef4444", borderRadius: 28,
    paddingHorizontal: 20, paddingVertical: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 5
  },
  fabActive: { backgroundColor: "#6b7280" },
  fabText: { color: "white", fontWeight: "700", fontSize: 15 }
});
