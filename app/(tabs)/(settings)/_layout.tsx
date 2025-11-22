import { Stack } from "expo-router";

export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: "Settings",
          headerStyle: { backgroundColor: "#FFFFFF" },
          headerTintColor: "#111827",
        }} 
      />
    </Stack>
  );
}