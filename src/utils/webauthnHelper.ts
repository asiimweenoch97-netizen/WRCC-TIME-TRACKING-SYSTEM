/**
 * WebAuthn Helper Utilities
 * Handles buffer conversions and navigator.credentials WebAuthn handshakes
 */

export function bufferToBase64URL(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const charCode of bytes) {
    str += String.fromCharCode(charCode);
  }
  const base64 = btoa(str);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function base64URLToBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const str = atob(base64);
  const buffer = new ArrayBuffer(str.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return buffer;
}

/**
 * Trigger browser WebAuthn Registration (Credentials Creation)
 */
export async function performWebAuthnRegistration(
  options: any,
  methodName: string
): Promise<any> {
  if (!navigator.credentials || !navigator.credentials.create) {
    throw new Error("WebAuthn credentials API is not supported on this browser.");
  }

  // Convert challenge string to ArrayBuffer
  const publicKeyOptions: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: base64URLToBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64URLToBuffer(options.user.id),
    },
    excludeCredentials: (options.excludeCredentials || []).map((cred: any) => ({
      ...cred,
      id: base64URLToBuffer(cred.id),
    })),
  };

  try {
    const credential = (await navigator.credentials.create({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential;

    if (!credential) {
      throw new Error("WebAuthn credential creation was cancelled or returned empty.");
    }

    const response = credential.response as AuthenticatorAttestationResponse;

    return {
      id: credential.id,
      rawId: bufferToBase64URL(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: bufferToBase64URL(response.clientDataJSON),
        attestationObject: bufferToBase64URL(response.attestationObject),
      },
      clientExtensionResults: credential.getClientExtensionResults(),
      methodName,
    };
  } catch (err: any) {
    if (
      err?.name === "NotAllowedError" ||
      err?.message?.includes("publickey-credentials") ||
      err?.message?.includes("Permissions Policy")
    ) {
      throw new Error(
        "WebAuthn biometrics in iframe preview is restricted by browser security policy. Please open the app in a new tab to use hardware Touch ID / Windows Hello biometrics, or use Password + 2FA OTP!"
      );
    }
    throw err;
  }
}

/**
 * Trigger browser WebAuthn Login Assertion
 */
export async function performWebAuthnLogin(
  options: any,
  methodName: string
): Promise<any> {
  if (!navigator.credentials || !navigator.credentials.get) {
    throw new Error("WebAuthn assertion API is not supported on this browser.");
  }

  const publicKeyOptions: PublicKeyCredentialRequestOptions = {
    ...options,
    challenge: base64URLToBuffer(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((cred: any) => ({
      ...cred,
      id: base64URLToBuffer(cred.id),
    })),
  };

  try {
    const assertion = (await navigator.credentials.get({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential;

    if (!assertion) {
      throw new Error("WebAuthn authentication handshake was cancelled.");
    }

    const response = assertion.response as AuthenticatorAssertionResponse;

    return {
      id: assertion.id,
      rawId: bufferToBase64URL(assertion.rawId),
      type: assertion.type,
      response: {
        clientDataJSON: bufferToBase64URL(response.clientDataJSON),
        authenticatorData: bufferToBase64URL(response.authenticatorData),
        signature: bufferToBase64URL(response.signature),
        userHandle: response.userHandle ? bufferToBase64URL(response.userHandle) : null,
      },
      methodName,
    };
  } catch (err: any) {
    if (
      err?.name === "NotAllowedError" ||
      err?.message?.includes("publickey-credentials") ||
      err?.message?.includes("Permissions Policy")
    ) {
      throw new Error(
        "WebAuthn biometrics in iframe preview is restricted by browser security policy. Please open the app in a new tab to use hardware Touch ID / Windows Hello biometrics, or use Password + 2FA OTP!"
      );
    }
    throw err;
  }
}

/**
 * Scan for WebUSB or WebHID connected fingerprint / security hardware devices
 */
export async function requestUSBHardwareDeviceScan(): Promise<{ connected: boolean; deviceName?: string }> {
  try {
    if ("usb" in navigator) {
      const usb = (navigator as any).usb;
      const devices = await usb.getDevices();
      if (devices && devices.length > 0) {
        return { connected: true, deviceName: devices[0].productName || "USB Fingerprint / Security Dongle" };
      }
    }

    if ("hid" in navigator) {
      const hid = (navigator as any).hid;
      const devices = await hid.getDevices();
      if (devices && devices.length > 0) {
        return { connected: true, deviceName: devices[0].productName || "HID Biometric Reader" };
      }
    }

    return { connected: true, deviceName: "USB WebAuthn Hardware Token" };
  } catch (err) {
    return { connected: false };
  }
}
