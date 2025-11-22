import { Stack } from "expo-router";

export default function CalendarLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: "Calendar",
          headerStyle: { backgroundColor: "#FFFFFF" },
          headerTintColor: "#111827",
        }} 
      />
    </Stack>
  );
}