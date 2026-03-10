import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import * as Location from "expo-location";
import { reportIssue } from "../api";

const CATEGORIES = [
  { id: "blocked_lane", label: "🚗 Lane Blocked by Car" },
  { id: "pothole", label: "🕳️ Pothole / Damage" },
  { id: "missing_sign", label: "🪧 Missing Sign" },
  { id: "danger", label: "⚠️ General Danger" },
  { id: "car_occupation", label: "🚙 Car Occupying Bike Lane" },
];

export default function ReportScreen() {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState(3);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!category) return Alert.alert("Please select a category");
    setLoading(true);
    try {
      const loc = await Location.getCurrentPositionAsync({});
      await reportIssue({
        category, description, severity,
        lat: loc.coords.latitude,
        lng: loc.coords.longitude
      });
      Alert.alert("✅ Report submitted!", "Thank you for helping improve Bucharest's bike infrastructure.");
      setCategory(""); setDescription(""); setSeverity(3);
    } catch (e) {
      Alert.alert("Error", "Could not submit report. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Report an Issue</Text>
      <Text style={styles.label}>Category</Text>
      {CATEGORIES.map(c => (
        <TouchableOpacity key={c.id}
          style={[styles.categoryBtn, category === c.id && styles.categorySelected]}
          onPress={() => setCategory(c.id)}
        >
          <Text style={{ color: category === c.id ? "white" : "#111" }}>{c.label}</Text>
        </TouchableOpacity>
      ))}
      <Text style={styles.label}>Severity (1–5)</Text>
      <View style={styles.severityRow}>
        {[1,2,3,4,5].map(n => (
          <TouchableOpacity key={n} style={[styles.severityBtn, severity === n && styles.severitySelected]}
            onPress={() => setSeverity(n)}>
            <Text style={{ color: severity === n ? "white" : "#111" }}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>Description (optional)</Text>
      <TextInput style={styles.input} multiline numberOfLines={3}
        placeholder="Describe the issue..." value={description}
        onChangeText={setDescription} />
      <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={loading}>
        <Text style={styles.submitText}>{loading ? "Submitting..." : "Submit Report"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f9fafb" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", marginTop: 16, marginBottom: 8, color: "#374151" },
  categoryBtn: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db", marginBottom: 6, backgroundColor: "white" },
  categorySelected: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  severityRow: { flexDirection: "row", gap: 8 },
  severityBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#d1d5db", alignItems: "center", backgroundColor: "white" },
  severitySelected: { backgroundColor: "#ef4444", borderColor: "#ef4444" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, backgroundColor: "white", minHeight: 80, textAlignVertical: "top" },
  submitBtn: { marginTop: 24, backgroundColor: "#16a34a", padding: 16, borderRadius: 12, alignItems: "center" },
  submitText: { color: "white", fontSize: 16, fontWeight: "700" }
});
