import React from 'react';
import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack>
      <Stack.Screen name="catalog" options={{ title: 'FVE Catalog', headerShown: true }} />
      <Stack.Screen name="bonuses" options={{ title: 'FVE NextCruise Bonuses', headerShown: true }} />
      <Stack.Screen name="pricing" options={{ title: 'FVE Pricing Models', headerShown: true }} />
    </Stack>
  );
}
