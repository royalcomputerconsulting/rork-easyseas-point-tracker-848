import AsyncStorage from '@react-native-async-storage/async-storage';

export async function loadCruisesDatabase() {
  try {
    const data = await AsyncStorage.getItem('cruises');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[DataLoader] Error loading cruises:', error);
    return [];
  }
}

export async function loadBookedCruises() {
  try {
    const data = await AsyncStorage.getItem('booked');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[DataLoader] Error loading booked cruises:', error);
    return [];
  }
}

export async function loadOffers() {
  try {
    const data = await AsyncStorage.getItem('offers');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[DataLoader] Error loading offers:', error);
    return [];
  }
}

export async function loadCalendarEvents() {
  try {
    const data = await AsyncStorage.getItem('calendar');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[DataLoader] Error loading calendar:', error);
    return [];
  }
}

export async function loadTripItEvents() {
  try {
    const data = await AsyncStorage.getItem('tripit');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[DataLoader] Error loading tripit:', error);
    return [];
  }
}
