import { db } from "./config";
import { collection, doc, setDoc } from "firebase/firestore";
import type { AuditLog, AuditAction, AuditSeverity } from "@/types";
import * as Device from "expo-device";
import { Platform } from "react-native";

export interface LogAuditActionOptions {
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  module: AuditLog["module"];
  action: AuditAction;
  description: string;
  metadata?: AuditLog["metadata"];
  severity?: AuditSeverity;
  entityId?: string;
  entityName?: string;
  sessionId?: string;
}

/**
 * Logs an action to the central audit_logs collection.
 * Automatically captures device info.
 */
export async function logAuditAction(options: LogAuditActionOptions): Promise<void> {
  try {
    const auditRef = doc(collection(db, "audit_logs"));
    
    // Attempt to extract browser details if on web
    let browser = "Unknown";
    let userAgent = "Unknown";
    let os = "Unknown OS";
    let isMobile = false;
    let platform = "Unknown Platform";
    
    if (Platform.OS === "web") {
      userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "Unknown";
      if (userAgent.includes("Chrome")) browser = "Chrome";
      else if (userAgent.includes("Firefox")) browser = "Firefox";
      else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari";
      else if (userAgent.includes("Edge")) browser = "Edge";
      
      platform = typeof navigator !== "undefined" ? navigator.platform : "web";
      os = userAgent.includes("Windows") ? "Windows" : userAgent.includes("Mac") ? "MacOS" : userAgent.includes("Linux") ? "Linux" : "Unknown OS";
      isMobile = typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);
    } else {
      userAgent = "Native App";
      platform = Device.modelName || "Unknown Mobile";
      browser = "Native App";
      os = `${Device.osName} ${Device.osVersion}`;
      isMobile = true;
    }

    const log: any = {
      id: auditRef.id,
      userId: options.userId,
      userEmail: options.userEmail,
      userName: options.userName,
      userRole: options.userRole,
      module: options.module,
      action: options.action,
      description: options.description,
      metadata: options.metadata || {},
      deviceInfo: {
        userAgent,
        platform,
        browser,
        os,
        isMobile,
      },
      severity: options.severity || "low",
      timestamp: new Date().toISOString(),
    };

    if (options.entityId !== undefined) log.entityId = options.entityId;
    if (options.entityName !== undefined) log.entityName = options.entityName;
    if (options.sessionId !== undefined) log.sessionId = options.sessionId;

    await setDoc(auditRef, log);
  } catch (error) {
    console.error("Failed to write audit log:", error);
    // We typically don't throw error here to avoid breaking the main user flow if logging fails
  }
}
