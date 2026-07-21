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
exports.sendEmailOnNewExpense = exports.sendEmailOnNewLeave = exports.sendPushNotificationOnNewDoc = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
const nodemailer = __importStar(require("nodemailer"));
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
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'darshan.mevada@techsture.com',
        pass: 'twpenrekdfrxfosd',
    },
});
async function getEmailsForUsers(userIds) {
    const db = (0, firestore_2.getFirestore)();
    const emails = [];
    for (const uid of userIds) {
        const snap = await db.collection('users').doc(uid).get();
        if (snap.exists) {
            const data = snap.data();
            if (data === null || data === void 0 ? void 0 : data.email)
                emails.push(data.email);
        }
    }
    return emails;
}
async function getEmailsByRole(role) {
    const db = (0, firestore_2.getFirestore)();
    const emails = [];
    try {
        const snap = await db.collection('users').where('role', '==', role).get();
        snap.forEach(doc => {
            const data = doc.data();
            if (data === null || data === void 0 ? void 0 : data.email)
                emails.push(data.email);
        });
        const roleIdSnap = await db.collection('users').where('roleId', '==', `role_${role}`).get();
        roleIdSnap.forEach(doc => {
            const data = doc.data();
            if ((data === null || data === void 0 ? void 0 : data.email) && !emails.includes(data.email))
                emails.push(data.email);
        });
        // Also try exact match for roleId
        const exactRoleIdSnap = await db.collection('users').where('roleId', '==', role).get();
        exactRoleIdSnap.forEach(doc => {
            const data = doc.data();
            if ((data === null || data === void 0 ? void 0 : data.email) && !emails.includes(data.email))
                emails.push(data.email);
        });
    }
    catch (error) {
        console.error(`Error fetching emails for role ${role}:`, error);
    }
    return emails;
}
exports.sendEmailOnNewLeave = (0, firestore_1.onDocumentCreated)('leaves/{leaveId}', async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const data = snap.data();
    const approvers = data.approvers || [];
    const approverEmails = await getEmailsForUsers(approvers);
    const hrEmails = await getEmailsByRole('hr');
    const hrManagerEmails = await getEmailsByRole('hr_manager');
    const allEmails = [...new Set([...approverEmails, ...hrEmails, ...hrManagerEmails])];
    if (allEmails.length === 0)
        return;
    const db = (0, firestore_2.getFirestore)();
    let employeeName = 'An employee';
    if (data.employeeId) {
        const empSnap = await db.collection('users').doc(data.employeeId).get();
        if (empSnap.exists) {
            const empData = empSnap.data();
            employeeName = (empData === null || empData === void 0 ? void 0 : empData.firstName) ? `${empData.firstName} ${empData.lastName || ''}`.trim() : ((empData === null || empData === void 0 ? void 0 : empData.displayName) || 'An employee');
        }
    }
    const mailOptions = {
        from: '"Techsture HRMS" <darshan.mevada@techsture.com>',
        to: allEmails.join(','),
        subject: `New Leave Request from ${employeeName}`,
        html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f7f6; padding: 40px 20px; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
          <div style="background-color: #0066cc; padding: 25px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 0.5px;">New Leave Request</h2>
          </div>
          <div style="padding: 30px;">
            <p style="font-size: 16px; line-height: 1.5; margin-bottom: 25px;">Hello,</p>
            <p style="font-size: 16px; line-height: 1.5; margin-bottom: 25px;"><strong>${employeeName}</strong> has submitted a new leave request that requires your attention.</p>
            
            <div style="background-color: #f9f9f9; border-left: 4px solid #0066cc; padding: 15px 20px; margin-bottom: 30px; border-radius: 0 4px 4px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; width: 120px; color: #666;"><strong>Duration:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee;">${data.totalDays} day(s)</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; color: #666;"><strong>Type:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; text-transform: capitalize;">${data.type}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; color: #666;"><strong>Date:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee;">${data.startDate} to ${data.endDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Reason:</strong></td>
                  <td style="padding: 8px 0;">${data.reason}</td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin-top: 40px; margin-bottom: 20px;">
              <a href="https://techsture.vercel.app/" style="background-color: #0066cc; color: #ffffff; text-decoration: none; padding: 14px 28px; font-weight: bold; border-radius: 6px; display: inline-block; font-size: 16px;">View Dashboard</a>
            </div>
          </div>
          <div style="background-color: #f9f9f9; padding: 15px; text-align: center; border-top: 1px solid #eeeeee; font-size: 13px; color: #999;">
            <p style="margin: 0;">This is an automated message from Techsture HRMS.</p>
          </div>
        </div>
      </div>
    `
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log('Leave email sent successfully to:', allEmails);
    }
    catch (error) {
        console.error('Error sending leave email:', error);
    }
});
exports.sendEmailOnNewExpense = (0, firestore_1.onDocumentCreated)('expenses/{expenseId}', async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const data = snap.data();
    const approvers = data.approvers || [];
    const approverEmails = await getEmailsForUsers(approvers);
    const financeEmails = await getEmailsByRole('finance');
    const financeManagerEmails = await getEmailsByRole('finance_manager');
    const allEmails = [...new Set([...approverEmails, ...financeEmails, ...financeManagerEmails])];
    if (allEmails.length === 0)
        return;
    const db = (0, firestore_2.getFirestore)();
    let employeeName = 'An employee';
    if (data.employeeId) {
        const empSnap = await db.collection('users').doc(data.employeeId).get();
        if (empSnap.exists) {
            const empData = empSnap.data();
            employeeName = (empData === null || empData === void 0 ? void 0 : empData.firstName) ? `${empData.firstName} ${empData.lastName || ''}`.trim() : ((empData === null || empData === void 0 ? void 0 : empData.displayName) || 'An employee');
        }
    }
    const mailOptions = {
        from: '"Techsture HRMS" <darshan.mevada@techsture.com>',
        to: allEmails.join(','),
        subject: `New Expense Claim from ${employeeName}`,
        html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f7f6; padding: 40px 20px; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
          <div style="background-color: #28a745; padding: 25px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 0.5px;">New Expense Claim</h2>
          </div>
          <div style="padding: 30px;">
            <p style="font-size: 16px; line-height: 1.5; margin-bottom: 25px;">Hello,</p>
            <p style="font-size: 16px; line-height: 1.5; margin-bottom: 25px;"><strong>${employeeName}</strong> has submitted a new expense claim that requires your review.</p>
            
            <div style="background-color: #f9f9f9; border-left: 4px solid #28a745; padding: 15px 20px; margin-bottom: 30px; border-radius: 0 4px 4px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; width: 120px; color: #666;"><strong>Amount:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; font-weight: bold; font-size: 16px;">₹${data.amount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; color: #666;"><strong>Category:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee;">${data.category}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; color: #666;"><strong>Date:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee;">${data.date}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Description:</strong></td>
                  <td style="padding: 8px 0;">${data.description}</td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin-top: 40px; margin-bottom: 20px;">
              <a href="https://techsture.vercel.app/" style="background-color: #28a745; color: #ffffff; text-decoration: none; padding: 14px 28px; font-weight: bold; border-radius: 6px; display: inline-block; font-size: 16px;">View Dashboard</a>
            </div>
          </div>
          <div style="background-color: #f9f9f9; padding: 15px; text-align: center; border-top: 1px solid #eeeeee; font-size: 13px; color: #999;">
            <p style="margin: 0;">This is an automated message from Techsture HRMS.</p>
          </div>
        </div>
      </div>
    `
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log('Expense email sent successfully to:', allEmails);
    }
    catch (error) {
        console.error('Error sending expense email:', error);
    }
});
//# sourceMappingURL=index.js.map