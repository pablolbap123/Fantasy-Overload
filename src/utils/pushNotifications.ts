import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import type { SupabaseClient } from "@supabase/supabase-js";

const pushChannelId = "overload_fantasy";
let registeredUserId: string | null = null;
let listenersReady = false;

type PushPayload = {
  leagueId: string;
  userIds: string[];
  title?: string;
  body: string;
  data?: Record<string, string | number | boolean | null | undefined>;
};

const toStringData = (data: PushPayload["data"]) =>
  Object.fromEntries(
    Object.entries(data ?? {})
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)]),
  );

export const setupFantasyPushNotifications = async (client: SupabaseClient, userId: string) => {
  if (!Capacitor.isNativePlatform()) return;
  if (registeredUserId === userId) return;

  try {
    await PushNotifications.createChannel({
      id: pushChannelId,
      name: "OverloadFantasy",
      description: "Fichajes, pujas, clausulazos y avisos importantes.",
      importance: 5,
      visibility: 1,
      sound: "default",
    });
  } catch (error) {
    console.warn("No se pudo crear el canal push", error);
  }

  if (!listenersReady) {
    await PushNotifications.addListener("registration", async (token) => {
      const currentUserId = registeredUserId;
      if (!currentUserId || !token.value) return;
      try {
        const { error } = await client.from("push_subscriptions").upsert(
          {
            user_id: currentUserId,
            token: token.value,
            platform: Capacitor.getPlatform(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "token" },
        );
        if (error) throw error;
      } catch (error) {
        console.warn("No se pudo guardar el token FCM", error);
      }
    });

    await PushNotifications.addListener("registrationError", (error) => {
      console.warn("Error registrando push FCM", error);
    });

    listenersReady = true;
  }

  let permission;
  try {
    permission = await PushNotifications.checkPermissions();
    if (permission.receive === "prompt") {
      permission = await PushNotifications.requestPermissions();
    }
  } catch (error) {
    console.warn("No se pudo solicitar permiso push", error);
    return;
  }
  if (permission.receive !== "granted") return;

  registeredUserId = userId;
  try {
    await PushNotifications.register();
  } catch (error) {
    registeredUserId = null;
    console.warn("No se pudo registrar FCM", error);
  }
};

export const sendRemoteFantasyPush = async (client: SupabaseClient, payload: PushPayload) => {
  const userIds = [...new Set(payload.userIds.filter(Boolean))];
  if (userIds.length === 0) return;

  await client.functions.invoke("send-push", {
    body: {
      leagueId: payload.leagueId,
      userIds,
      title: payload.title ?? "OverloadFantasy",
      body: payload.body,
      data: toStringData(payload.data),
    },
  });
};
