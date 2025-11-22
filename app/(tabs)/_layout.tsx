import { Tabs } from "expo-router";
import { 
  Tag, 
  CalendarCheck, 
  CalendarDays,
  Bookmark, 
  BarChart3, 
  Settings
} from "lucide-react-native";
import React, { useMemo } from "react";
import { Platform, View } from "react-native";
import { COLORS, SHADOW } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="(overview)"
      screenOptions={{
        tabBarActiveTintColor: COLORS.white,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.7)',
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : COLORS.primaryBlue,
          borderTopColor: 'transparent',
          height: Platform.OS === 'ios' ? 90 : 68,
          paddingBottom: Platform.OS === 'ios' ? 22 : 10,
          paddingTop: 10,
          ...SHADOW.floating,
        },
        tabBarBackground: () => (
          Platform.OS === 'ios' ? (
            <BlurView
              intensity={80}
              tint="dark"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                overflow: 'hidden',
              }}
            >
              <LinearGradient
                colors={['#003087', '#0066CC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  opacity: 0.96,
                }}
              />
            </BlurView>
          ) : (
            <LinearGradient
              colors={['#003087', '#0066CC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />
          )
        ),
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700' as const,
          color: COLORS.white,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="(overview)"
        options={{
          title: "Offers",
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              padding: 8,
              borderRadius: 16,
              backgroundColor: focused ? 'rgba(212,175,55,0.15)' : 'transparent',
            }}>
              <Tag size={22} color={color} />
              {focused && (
                <View style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  bottom: 2,
                  left: 2,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(212,175,55,0.35)'
                }} />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="(scheduling)"
        options={{
          title: "Scheduling",
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              padding: 8,
              borderRadius: 16,
              backgroundColor: focused ? 'rgba(212,175,55,0.15)' : 'transparent',
            }}>
              <CalendarCheck size={22} color={color} />
              {focused && (
                <View style={{ position: 'absolute', top: 2, right: 2, bottom: 2, left: 2, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)' }} />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="(booked)"
        options={{
          title: "Booked",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ padding: 8, borderRadius: 16, backgroundColor: focused ? 'rgba(212,175,55,0.15)' : 'transparent' }}>
              <Bookmark size={22} color={color} />
              {focused && (<View style={{ position: 'absolute', top: 2, right: 2, bottom: 2, left: 2, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)' }} />)}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="(events)"
        options={{
          title: "Events",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ padding: 8, borderRadius: 16, backgroundColor: focused ? 'rgba(212,175,55,0.15)' : 'transparent' }}>
              <CalendarDays size={22} color={color} />
              {focused && (<View style={{ position: 'absolute', top: 2, right: 2, bottom: 2, left: 2, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)' }} />)}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="(analytics)"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ padding: 8, borderRadius: 16, backgroundColor: focused ? 'rgba(212,175,55,0.15)' : 'transparent' }}>
              <BarChart3 size={22} color={color} />
              {focused && (<View style={{ position: 'absolute', top: 2, right: 2, bottom: 2, left: 2, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)' }} />)}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="(settings)"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ padding: 8, borderRadius: 16, backgroundColor: focused ? 'rgba(212,175,55,0.15)' : 'transparent' }}>
              <Settings size={22} color={color} />
              {focused && (<View style={{ position: 'absolute', top: 2, right: 2, bottom: 2, left: 2, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)' }} />)}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="(cruises)"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="(calendar)"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}