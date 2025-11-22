import { Stack } from "expo-router";
import React from "react";

export default function EventsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#6C5CE7",
        },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: {
          fontWeight: "600" as const,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}