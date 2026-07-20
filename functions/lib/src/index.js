"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotificationOnNewDoc = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
/**
 * Triggers when a new document is added to users/{userId}/notifications
 * This will read the user's deviceTokens and send a Push Notification (FCM)
 */
exports.sendPushNotificationOnNewDoc = functions.firestore
    .document("users/{userId}/notifications/{notificationId}")
    .onCreate(async (snap, context) => {
    const { userId } = context.params;
    const notificationData = snap.data();
    // The data written from the frontend GlobalNotificationToast 
    // It usually has title, message, type, module
    const { title, message } = notificationData;
    if (!title || !message) {
        console.log("No title or message. Skipping push notification.");
        return null;
    }
    try {
        // Fetch the user's device tokens
        const userRef = admin.firestore().collection("users").doc(userId);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            console.log(`User ${userId} does not exist`);
            return null;
        }
        const userData = userSnap.data();
        const tokens = (userData === null || userData === void 0 ? void 0 : userData.deviceTokens) || [];
        if (tokens.length === 0) {
            console.log(`No device tokens found for user ${userId}`);
            return null;
        }
        // Prepare the Push Notification payload
        const payload = {
            notification: {
                title: title,
                body: message,
                sound: "default",
                badge: "1",
            },
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK", // Works for Expo too
                module: notificationData.module || "default",
                notifId: snap.id,
            },
        };
        // Send to all registered devices for this user
        const response = await admin.messaging().sendToDevice(tokens, payload);
        console.log(`Sent push notification to ${tokens.length} devices for user ${userId}. Success: ${response.successCount}, Failures: ${response.failureCount}`);
        // Cleanup expired/invalid tokens
        if (response.failureCount > 0) {
            const tokensToRemove = [];
            response.results.forEach((result, index) => {
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
                    deviceTokens: admin.firestore.FieldValue.arrayRemove(...tokensToRemove),
                });
                console.log("Removed invalid tokens:", tokensToRemove);
            }
        }
        return null;
    }
    catch (error) {
        console.error("Error sending push notification:", error);
        return null;
    }
});
//# sourceMappingURL=index.js.map