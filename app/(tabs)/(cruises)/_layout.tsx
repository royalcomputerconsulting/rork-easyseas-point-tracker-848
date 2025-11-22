import { Stack } from "expo-router";

export default function CruisesLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: "Cruises",
          headerStyle: { backgroundColor: "#FFFFFF" },
          headerTintColor: "#111827",
        }} 
      />
    </Stack>
  );
}