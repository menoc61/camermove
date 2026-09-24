import Constants from "expo-constants";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

/**
 * Push notification bootstrap.
 *
 * - Requests POST_NOTIFICATIONS permission on Android 13+
 * - Resolves a project push token via the lazily-loaded `expo-notifications`
 * - Registers a foreground listener so in-app toasts reflect inbound events
 *
 * If `expo-notifications` or `expo-device` are not yet installed (e.g. the
 * build environment failed to add the native module), every call is a noop
 * so the rest of the app keeps working.
 */

export interface PushRegistration {
  token?: string;
  error?: string;
}

interface NotificationContent {
  title?: string | null;
  body?: string | null;
  data?: unknown;
}

interface NotificationLike {
  request: { content: NotificationContent };
}

interface NotificationsAPI {
  setNotificationChannelAsync: (
    id: string,
    opts: { name: string; importance: number; vibrationPattern?: number[]; lightColor?: string },
  ) => Promise<void>;
  getPermissionsAsync: () => Promise<{ status: string }>;
  requestPermissionsAsync: () => Promise<{ status: string }>;
  getExpoPushTokenAsync: (opts: { projectId?: string }) => Promise<{ data: string }>;
  setNotificationHandler: (handler: {
    handleNotification: () => Promise<{
      shouldShowAlert: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
      shouldShowBanner: boolean;
      shouldShowList: boolean;
    }>;
  }) => void;
  addNotificationReceivedListener: (
    cb: (n: NotificationLike) => void,
  ) => { remove: () => void };
  addNotificationResponseReceivedListener: (
    cb: (n: { notification: NotificationLike }) => void,
  ) => { remove: () => void };
  AndroidImportance: { MAX: number };
}

let expoNotifications: NotificationsAPI | null = null;
let Device: { isDevice: boolean } | null = null;
try {
  // Dynamic require so this module is tolerant of an uninstalled peer.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  expoNotifications = require("expo-notifications") as NotificationsAPI;
} catch {
  expoNotifications = null;
}
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Device = require("expo-device") as { isDevice: boolean };
} catch {
  Device = null;
}

async function registerForPush(): Promise<PushRegistration> {
  if (!expoNotifications) {
    return { error: "expo-notifications not installed" };
  }
  if (!Device?.isDevice) {
    return { error: "Notifications require a physical device" };
  }
  if (Platform.OS === "android") {
    await expoNotifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: expoNotifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }
  const { status } = await expoNotifications.getPermissionsAsync();
  let finalStatus = status;
  if (status !== "granted") {
    const request = await expoNotifications.requestPermissionsAsync();
    finalStatus = request.status;
  }
  if (finalStatus !== "granted") {
    return { error: "Permission not granted" };
  }
  try {
    const tokenResp = await expoNotifications.getExpoPushTokenAsync({
      projectId: (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId,
    });
    return { token: tokenResp.data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Token registration failed" };
  }
}

export function usePushNotifications(opts: {
  onToken?: (token: string) => void;
  onError?: (message: string) => void;
  onReceive?: (data: { title: string; body: string; data?: unknown }) => void;
}) {
  const { onToken, onError, onReceive } = opts;
  const subRef = useRef<{ remove: () => void } | null>(null);
  const responseSubRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!expoNotifications) {
      onError?.("expo-notifications not installed");
      return;
    }
    expoNotifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    void registerForPush().then((resp) => {
      if (!mounted) return;
      if (resp.token) onToken?.(resp.token);
      if (resp.error) onError?.(resp.error);
    });

    subRef.current = expoNotifications.addNotificationReceivedListener((notification) => {
      const title = notification.request.content.title ?? "";
      const body = notification.request.content.body ?? "";
      onReceive?.({ title, body, data: notification.request.content.data });
    });
    responseSubRef.current = expoNotifications.addNotificationResponseReceivedListener((response) => {
      const title = response.notification.request.content.title ?? "";
      const body = response.notification.request.content.body ?? "";
      onReceive?.({ title, body, data: response.notification.request.content.data });
    });

    return () => {
      mounted = false;
      subRef.current?.remove();
      responseSubRef.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
