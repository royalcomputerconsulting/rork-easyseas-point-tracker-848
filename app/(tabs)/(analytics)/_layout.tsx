import { Stack } from "expo-router";

export default function AnalyticsLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="intelligence" 
        options={{ 
          title: "Intelligence",
          headerStyle: { backgroundColor: "#FFFFFF" },
          headerTintColor: "#111827",
        }} 
      />
      <Stack.Screen 
        name="charts" 
        options={{ 
          title: "Charts",
          headerStyle: { backgroundColor: "#FFFFFF" },
          headerTintColor: "#111827",
        }} 
      />
    </Stack>
  );
}