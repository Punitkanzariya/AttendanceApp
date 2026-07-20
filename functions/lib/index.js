"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotificationOnNewDoc = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
if ((0, app_1.getApps)().length === 0) {
    (0, app_1.initializeApp)();
}
/**
 * Triggers when a new document is added to notifications/{userId}/items
 * This will read the user's deviceTokens and send a Push Notification (FCM)
 */
exports.sendPushNotificationOnNewDoc = (0, firestore_1.onDocumentCreated)("notifications/{userId}/items/{notificationId}", async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const { userId } = event.params;
    const notificationData = snap.data();
    // The data written from the frontend GlobalNotificationToast 
    // It usually has title, message, type, module
    const { title, message } = notificationData;
    if (!title || !message) {
        console.log("No title or message. Skipping push notification.");
        return;
    }
    try {
        // Fetch the user's device tokens
        const userRef = (0, firestore_2.getFirestore)().collection("users").doc(userId);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            console.log(`User ${userId} does not exist`);
            return;
        }
        const userData = userSnap.data();
        const tokens = (userData === null || userData === void 0 ? void 0 : userData.deviceTokens) || [];
        if (tokens.length === 0) {
            console.log(`No device tokens found for user ${userId}`);
            return;
        }
        // Prepare the Push Notification payload
        const payload = {
            notification: {
                title: title,
                body: message,
            },
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                module: notificationData.module || "default",
                notifId: snap.id,
            },
            tokens: tokens,
        };
        // Send to all registered devices for this user
        const response = await (0, messaging_1.getMessaging)().sendEachForMulticast(payload);
        console.log(`Sent push notification to ${tokens.length} devices for user ${userId}. Success: ${response.successCount}, Failures: ${response.failureCount}`);
        // Cleanup expired/invalid tokens
        if (response.failureCount > 0) {
            const tokensToRemove = [];
            response.responses.forEach((result, index) => {
                const error = result.error;
                if (error) {
                    if (error.code === "messaging/invalid-registration-token" ||
                        error.code === "messaging/registration-token-not-registered") {
                        tokensToRemove.push(tokens[index]);
                    }
                }
            });
            if (tokensToRemove.length > 0) {
                await userRef.update({
                    deviceTokens: firestore_2.FieldValue.arrayRemove(...tokensToRemove),
                });
                console.log("Removed invalid tokens:", tokensToRemove);
            }
        }
        return;
    }
    catch (error) {
        console.error("Error sending push notification:", error);
        return;
    }
});
//# sourceMappingURL=index.js.map