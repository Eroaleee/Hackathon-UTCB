import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import MapScreen from "./src/screens/MapScreen";
import ReportScreen from "./src/screens/ReportScreen";

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ tabBarActiveTintColor: "#22c55e" }}>
        <Tab.Screen name="Map" component={MapScreen} options={{ tabBarLabel: "🗺️ Map" }} />
        <Tab.Screen name="Report" component={ReportScreen} options={{ tabBarLabel: "⚠️ Report" }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
