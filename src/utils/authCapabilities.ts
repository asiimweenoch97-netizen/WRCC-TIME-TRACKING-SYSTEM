/**
 * Smart Cross-Platform Authentication Capability Detector
 * Identifies hardware & OS platform biometric & hardware key capabilities
 */

export type AuthMethodId =
  | "usb_fingerprint"
  | "windows_hello"
  | "android_fingerprint"
  | "apple_biometrics"
  | "webauthn_passkey"
  | "password_otp";

export interface AuthCapability {
  id: AuthMethodId;
  name: string;
  priority: number; // 1 (highest) to 6 (lowest fallback)
  isAvailable: boolean;
  isPlatformNative: boolean;
  iconName: string;
  description: string;
  badgeText: string;
  hardwareDetail: string;
}

export interface DeviceCapabilityReport {
  userAgent: string;
  platformName: "windows" | "mac" | "ios" | "android" | "linux" | "other";
  hasWebAuthn: boolean;
  hasPlatformAuthenticator: boolean;
  hasWebUSB: boolean;
  hasWebHID: boolean;
  hasConditionalMediation: boolean;
  detectedMethods: AuthCapability[];
  recommendedMethod: AuthCapability;
}

/**
 * Detect OS Platform
 */
export function detectOSPlatform(): "windows" | "mac" | "ios" | "android" | "linux" | "other" {
  if (typeof window === "undefined" || !navigator) return "other";
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || "").toLowerCase();

  if (ua.includes("android")) return "android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod") || (platform.includes("mac") && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  if (platform.includes("mac") || ua.includes("macintosh")) return "mac";
  if (platform.includes("win") || ua.includes("windows")) return "windows";
  if (platform.includes("linux") || ua.includes("linux")) return "linux";

  return "other";
}

/**
 * Perform asynchronous hardware and browser security capability analysis
 */
export async function detectAuthCapabilities(): Promise<DeviceCapabilityReport> {
  const os = detectOSPlatform();
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";

  // Feature flags
  const hasWebAuthn = typeof window !== "undefined" && Boolean(window.PublicKeyCredential);
  
  let hasPlatformAuthenticator = false;
  if (hasWebAuthn && window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
    try {
      hasPlatformAuthenticator = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      hasPlatformAuthenticator = false;
    }
  }

  let hasConditionalMediation = false;
  if (hasWebAuthn && (window.PublicKeyCredential as any).isConditionalMediationAvailable) {
    try {
      hasConditionalMediation = await (window.PublicKeyCredential as any).isConditionalMediationAvailable();
    } catch {
      hasConditionalMediation = false;
    }
  }

  const hasWebUSB = typeof navigator !== "undefined" && "usb" in navigator;
  const hasWebHID = typeof navigator !== "undefined" && "hid" in navigator;

  // Build Hierarchy List
  // Priority 1: USB Fingerprint Scanner
  const usbAvailable = hasWebAuthn && (hasWebUSB || hasWebHID);
  const usbMethod: AuthCapability = {
    id: "usb_fingerprint",
    name: "USB Fingerprint / Hardware Scanner",
    priority: 1,
    isAvailable: usbAvailable,
    isPlatformNative: false,
    iconName: "Usb",
    description: "External USB Biometric Sensor or Hardware Security Token",
    badgeText: usbAvailable ? "Hardware Reader Detected" : "Hardware API Unavailable",
    hardwareDetail: hasWebUSB ? "WebUSB & WebHID Ready" : "Generic Security Key",
  };

  // Priority 2: Windows Hello
  const isWinHelloAvailable = hasWebAuthn && hasPlatformAuthenticator && os === "windows";
  const winHelloMethod: AuthCapability = {
    id: "windows_hello",
    name: "Windows Hello Biometrics",
    priority: 2,
    isAvailable: isWinHelloAvailable,
    isPlatformNative: true,
    iconName: "Laptop",
    description: "Native Windows Facial Recognition / Fingerprint Reader",
    badgeText: isWinHelloAvailable ? "Windows Hello Verified" : "Not Active on OS",
    hardwareDetail: "TPM 2.0 / Windows Security Subsystem",
  };

  // Priority 3: Android Fingerprint
  const isAndroidAvailable = hasWebAuthn && hasPlatformAuthenticator && os === "android";
  const androidMethod: AuthCapability = {
    id: "android_fingerprint",
    name: "Android Biometrics & Fingerprint",
    priority: 3,
    isAvailable: isAndroidAvailable,
    isPlatformNative: true,
    iconName: "Smartphone",
    description: "Android BiometricPrompt / Knox Security Enclave",
    badgeText: isAndroidAvailable ? "Android Biometrics Ready" : "Mobile Sensor Offline",
    hardwareDetail: "Android KeyStore / BiometricPrompt API",
  };

  // Priority 4: Apple Face ID / Touch ID
  const isAppleAvailable = hasWebAuthn && hasPlatformAuthenticator && (os === "mac" || os === "ios");
  const appleMethod: AuthCapability = {
    id: "apple_biometrics",
    name: "Apple Touch ID / Face ID",
    priority: 4,
    isAvailable: isAppleAvailable,
    isPlatformNative: true,
    iconName: "Fingerprint",
    description: "Apple Secure Enclave Biometric Verification",
    badgeText: isAppleAvailable ? "Touch ID / Face ID Ready" : "Secure Enclave Inactive",
    hardwareDetail: "Apple Secure Enclave (Local Authentication)",
  };

  // Priority 5: WebAuthn Passkey
  const isPasskeyAvailable = hasWebAuthn;
  const passkeyMethod: AuthCapability = {
    id: "webauthn_passkey",
    name: "WebAuthn Passkey & Security Key",
    priority: 5,
    isAvailable: isPasskeyAvailable,
    isPlatformNative: false,
    iconName: "Key",
    description: "FIDO2 / WebAuthn Cross-Device Passkey Token",
    badgeText: isPasskeyAvailable ? "FIDO2 WebAuthn Supported" : "WebAuthn Not Supported",
    hardwareDetail: hasConditionalMediation ? "Passkey Autofill Enabled" : "FIDO2 Standard",
  };

  // Priority 6: Password + OTP (Always available fallback)
  const passwordOtpMethod: AuthCapability = {
    id: "password_otp",
    name: "Password + 2FA OTP Code",
    priority: 6,
    isAvailable: true,
    isPlatformNative: false,
    iconName: "Lock",
    description: "Standard Password Authentication with 2FA OTP Fallback",
    badgeText: "Universal Fallback Active",
    hardwareDetail: "PBKDF2 Cryptographic Hash + HMAC OTP",
  };

  const allMethods: AuthCapability[] = [
    usbMethod,
    winHelloMethod,
    androidMethod,
    appleMethod,
    passkeyMethod,
    passwordOtpMethod,
  ];

  // Filter available methods and sort by priority number (1 highest)
  const availableMethods = allMethods.filter((m) => m.isAvailable);
  availableMethods.sort((a, b) => a.priority - b.priority);

  // Recommended method is the highest priority available method
  const recommendedMethod = availableMethods[0] || passwordOtpMethod;

  return {
    userAgent: ua,
    platformName: os,
    hasWebAuthn,
    hasPlatformAuthenticator,
    hasWebUSB,
    hasWebHID,
    hasConditionalMediation,
    detectedMethods: allMethods,
    recommendedMethod,
  };
}
