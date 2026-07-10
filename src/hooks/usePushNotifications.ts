import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications(uid?: string | null) {
  const [deviceToken, setDeviceToken] = useState<string>('');
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    if (!uid) return;

    registerForPushNotificationsAsync(uid).then((token) => {
      if (token) setDeviceToken(token);
    });

    // This listener is fired whenever a notification is received while the app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Foreground notification received:', notification);
    });

    // This listener is fired whenever a user taps on or interacts with a notification 
    // (works when app is foregrounded, backgrounded, or killed)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
      // Here you can handle navigation if payload contains a deep link (e.g., response.notification.request.content.data.link)
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [uid]);

  return { deviceToken };
}

async function registerForPushNotificationsAsync(uid: string) {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    return;
  }

  try {
    if (Platform.OS === 'web') {
      console.log('Push notifications not fully supported on web. Skipping native push token.');
      return;
    }
    
    // Get the native FCM/APNs token for firebase-admin compatibility
    const pushTokenData = await Notifications.getDevicePushTokenAsync();
    token = pushTokenData.data;
    console.log('Device Push Token (FCM/APNs):', token);
    
    await saveTokenToUser(uid, token);
  } catch (error) {
    console.error('Error fetching device push token:', error);
  }

  return token;
}

async function saveTokenToUser(uid: string, token: string) {
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const tokens = userData.deviceTokens || [];
      if (!tokens.includes(token)) {
        await updateDoc(userRef, {
          deviceTokens: [...tokens, token],
        });
        console.log('Saved new push token to user profile.');
      }
    }
  } catch (error) {
    console.error("Failed to save push token to user profile", error);
  }
}
