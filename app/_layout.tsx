import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import { AppStateProvider } from "@/state/AppStateProvider";
import { FiltersProvider } from "@/state/FiltersProvider";
import { trpc, trpcClient } from "@/lib/trpc";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FinancialsProvider } from "@/state/FinancialsProvider";
import { CasinoStrategyProvider } from "@/state/CasinoStrategyProvider";
import { SimpleAnalyticsProvider } from "@/state/SimpleAnalyticsProvider";
import { WelcomeSplash } from "@/components/WelcomeSplash";
import { UserProvider } from "@/state/UserProvider";
import { CruiseStoreProvider } from "@/state/CruiseStore";
import { CelebrityProvider } from "@/state/CelebrityProvider";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

const rootStyles = StyleSheet.create({
  gestureHandler: {
    flex: 1,
  },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="import" options={{ 
        title: "Import Data",
        presentation: "modal" 
      }} />
      <Stack.Screen name="cruise/[id]" options={{ 
        title: "Cruise Details",
        presentation: "card" 
      }} />
      <Stack.Screen name="offer/[id]" options={{ 
        title: "Offer Details",
        presentation: "card" 
      }} />
      <Stack.Screen name="alerts" options={{ 
        title: "Alerts",
        presentation: "modal" 
      }} />
      <Stack.Screen name="settings" options={{ 
        title: "Settings",
        presentation: "modal" 
      }} />
      <Stack.Screen name="ocr" options={{ 
        title: "OCR Scanner",
        presentation: "modal" 
      }} />
      <Stack.Screen name="points-status" options={{ 
        title: "Points & Status",
        presentation: "card" 
      }} />
      <Stack.Screen name="blue-chip-club" options={{ 
        title: "Blue Chip Club",
        presentation: "card" 
      }} />

    </Stack>
  );
}

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  
  if (showSplash) {
    return <WelcomeSplash onFinish={() => setShowSplash(false)} duration={10000} />;
  }
  
  return <RootLayoutNav />;
}

export default function RootLayout() {
  useEffect(() => {
    const hideSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (error) {
        console.error('[RootLayout] Failed to hide splash screen:', error);
      }
    };
    
    hideSplash();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <GestureHandlerRootView style={rootStyles.gestureHandler}>
            <UserProvider>
              <CruiseStoreProvider>
                <AppStateProvider>
                  <SimpleAnalyticsProvider>
                    <FinancialsProvider>
                      <CasinoStrategyProvider>
                        <FiltersProvider>
                          <CelebrityProvider>
                            <AppContent />
                          </CelebrityProvider>
                        </FiltersProvider>
                      </CasinoStrategyProvider>
                    </FinancialsProvider>
                  </SimpleAnalyticsProvider>
                </AppStateProvider>
              </CruiseStoreProvider>
            </UserProvider>
          </GestureHandlerRootView>
        </trpc.Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}