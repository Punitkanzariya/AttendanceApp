import { collection, query, orderBy, onSnapshot, doc, updateDoc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';

export interface AppNotification {
  notifId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  isRead: boolean;
  link?: string;
  sentBy: string; 
  senderName?: string; 
  receivedBy: string; 
  isBroadcast: boolean; 
  module?: "attendance" | "leave" | "expenses" | "users" | "roles" | "projects" | "settings" | "system" | "custom" | string;
  entityId?: string; 
  createdAt: string; 
}

/** Returns the Firestore collection ref for a user's notifications */
export function getNotificationCollection(uid: string) {
  return collection(db, "notifications", uid, "items");
}

export function subscribeToUserNotifications(
  uid: string,
  callback: (notifications: AppNotification[]) => void
): () => void {
  const q = query(getNotificationCollection(uid), orderBy("createdAt", "desc"));
  
  return onSnapshot(q, (snapshot) => {
    const items: AppNotification[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        notifId: d.id,
        title: data.title || "",
        message: data.message || "",
        type: data.type || "info",
        isRead: !!data.isRead,
        link: data.link,
        sentBy: data.sentBy || "system",
        senderName: data.senderName,
        receivedBy: data.receivedBy || uid,
        isBroadcast: !!data.isBroadcast,
        module: data.module,
        entityId: data.entityId,
        createdAt: data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      };
    });
    callback(items);
  }, (error) => {
    console.error("Error subscribing to notifications:", error);
  });
}

export async function markNotificationAsRead(uid: string, notifId: string) {
  const notifRef = doc(db, "notifications", uid, "items", notifId);
  await updateDoc(notifRef, { isRead: true });
}

export async function markAllNotificationsAsRead(uid: string) {
  const snapshot = await getDocs(getNotificationCollection(uid));
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => {
    if (!d.data().isRead) {
      batch.update(d.ref, { isRead: true });
    }
  });
  await batch.commit();
}
