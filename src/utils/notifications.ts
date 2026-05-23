import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export type FantasyNotificationPermission = NotificationPermission | "unsupported";
const nativeChannelId = "fantasy-transfers";
let nativeChannelReady = false;

const ensureNativeChannel = async () => {
  if (!Capacitor.isNativePlatform() || nativeChannelReady) return;
  await LocalNotifications.createChannel({
    id: nativeChannelId,
    name: "Overload Fantasy",
    description: "Fichajes, clausulazos y movimientos importantes.",
    importance: 5,
    visibility: 1,
  }).catch(() => undefined);
  nativeChannelReady = true;
};

export const getFantasyNotificationPermission = (): FantasyNotificationPermission => {
  if (Capacitor.isNativePlatform()) return "default";
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
};

export const requestFantasyNotificationPermission = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const current = await LocalNotifications.checkPermissions();
      const permission = current.display === "granted" ? current : await LocalNotifications.requestPermissions();
      if (permission.display === "granted") {
        await ensureNativeChannel();
        return "granted" as const;
      }
      return "denied" as const;
    } catch (error) {
      console.warn("No se pudo solicitar permiso de notificaciones locales", error);
      return "denied" as const;
    }
  }
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
  if (Notification.permission === "granted") return "granted" as const;
  if (Notification.permission === "denied") return "denied" as const;
  return Notification.requestPermission();
};

export const sendFantasyNotification = async (body: string) => {
  if (Capacitor.isNativePlatform()) {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== "granted") return;
    await ensureNativeChannel();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Date.now() % 2_147_483_647,
          title: "OverloadFantasy",
          body,
          channelId: nativeChannelId,
          smallIcon: "ic_launcher_foreground",
        },
      ],
    });
    return;
  }

  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  new Notification("OverloadFantasy", {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: `overload-${body}`,
  });
};
