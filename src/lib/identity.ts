/**
 * Per-phone identity generators. Each created device should have a unique
 * fingerprint — IMEI, MAC addresses, serial, Android ID, build number etc.
 * Same shape that gets passed to redroid `ro.*` props on container start.
 */

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

function randomDigits(n: number): string {
  const bytes = randomBytes(n);
  let out = '';
  for (let i = 0; i < n; i++) out += String(bytes[i]! % 10);
  return out;
}

function randomHex(n: number): string {
  const bytes = randomBytes(Math.ceil(n / 2));
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out.slice(0, n);
}

/** Luhn checksum for IMEI/credit cards. */
function luhnChecksum(numberWithoutChecksum: string): number {
  let sum = 0;
  for (let i = 0; i < numberWithoutChecksum.length; i++) {
    let digit = Number(numberWithoutChecksum[numberWithoutChecksum.length - 1 - i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return (10 - (sum % 10)) % 10;
}

/** TAC (Type Allocation Code) prefixes by brand — first 8 IMEI digits. */
const TAC_BY_BRAND: Record<string, string[]> = {
  Samsung: ['35471810', '35283210', '35892910', '35315710'],
  Google: ['35404211', '35850511', '35206011'],
  OnePlus: ['86891303', '86891403', '86891503'],
  Xiaomi: ['86753904', '86753804', '86753704'],
  Oppo: ['86870104', '86870204'],
  Vivo: ['86930205', '86930305'],
  Realme: ['86930405', '86930505'],
  Honor: ['86902001', '86902101'],
  Sony: ['35181810', '35181910'],
  Nothing: ['35986010'],
  Asus: ['35407811', '35407911'],
};

/** Generate a 15-digit IMEI with Luhn checksum, brand-appropriate TAC. */
export function generateImei(brand: string): string {
  const tacOptions = TAC_BY_BRAND[brand] ?? ['35000000'];
  const tac = tacOptions[Math.floor(Math.random() * tacOptions.length)]!;
  const serial = randomDigits(6); // 6 digits between TAC and check
  const base = tac + serial; // 14 digits
  return base + String(luhnChecksum(base));
}

/** Generate a 15-digit IMSI (SIM identifier). MCC+MNC+MSIN. */
export function generateImsi(): string {
  // Default to USA Tier-1 MCC+MNC (e.g. 310410 = AT&T). User can override.
  const mccMnc = '310410';
  return mccMnc + randomDigits(9);
}

/** 16 hex char Android ID (64-bit). */
export function generateAndroidId(): string {
  return randomHex(16);
}

/** Generate a brand-style serial number. */
export function generateSerialNumber(brand: string): string {
  switch (brand) {
    case 'Samsung':
      return 'R' + randomHex(2).toUpperCase() + randomHex(7).toUpperCase();
    case 'Google':
      return '1A' + randomDigits(3) + randomHex(7).toUpperCase();
    case 'OnePlus':
      return 'OP' + randomDigits(10);
    case 'Xiaomi':
      return 'mxi' + randomHex(8);
    case 'Oppo':
      return 'OPP' + randomDigits(9);
    case 'Vivo':
      return 'VV' + randomDigits(10);
    case 'Realme':
      return 'RMX' + randomDigits(8);
    case 'Honor':
      return 'HN' + randomDigits(10);
    case 'Sony':
      return 'YT' + randomHex(8).toUpperCase();
    case 'Nothing':
      return 'NTH' + randomDigits(9);
    case 'Asus':
      return 'M2A' + randomHex(8).toUpperCase();
    default:
      return randomHex(12).toUpperCase();
  }
}

/**
 * Generate a MAC address. Local-administered (2nd-least-significant bit of
 * first octet set) and unicast (least-significant bit clear) — safe for
 * synthetic devices, won't collide with real OUI assignments.
 */
export function generateMacAddress(): string {
  const bytes = randomBytes(6);
  // Force locally administered + unicast: bits 0=0, 1=1 in first octet.
  bytes[0] = (bytes[0]! & 0xfe) | 0x02;
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');
}

/**
 * Generate a Bluetooth MAC. Same scheme as Wi-Fi MAC but separate address.
 */
export const generateBluetoothMac = generateMacAddress;

/**
 * Generate a plausible build number string consistent with the template.
 * Pattern: `<BUILD_ID>.<YYMMDD>.<NNN>[.<userBuild>]` where userBuild is the
 * OEM increment number.
 */
export function generateBuildNumber(templateBuildId: string, brand: string): string {
  const userBuild = randomDigits(3);
  switch (brand) {
    case 'Samsung':
      // e.g. S928BXXU2AXG3 → keep base, regenerate the trailing build counter
      return templateBuildId + '/' + randomDigits(1) + randomHex(3).toUpperCase() + userBuild;
    case 'Google':
      // e.g. AP2A.240805.005 → bump increment
      return templateBuildId.replace(/\.\d+$/, '.' + userBuild.padStart(3, '0'));
    case 'OnePlus':
    case 'Oppo':
    case 'Realme':
      return templateBuildId + '_' + randomHex(6);
    default:
      return templateBuildId + '.' + userBuild;
  }
}

/**
 * Generate a phone number for a given country (E.164 format).
 * Country codes are approximate — extend as needed.
 */
const COUNTRY_DIAL: Record<string, { code: string; localLen: number; mobilePrefix: string[] }> = {
  US: { code: '+1', localLen: 10, mobilePrefix: ['202', '212', '305', '415', '617', '702', '917'] },
  UK: { code: '+44', localLen: 10, mobilePrefix: ['7400', '7500', '7700', '7800'] },
  BD: { code: '+880', localLen: 10, mobilePrefix: ['13', '14', '15', '16', '17', '18', '19'] },
  IN: { code: '+91', localLen: 10, mobilePrefix: ['70', '80', '90', '95', '98'] },
  CA: { code: '+1', localLen: 10, mobilePrefix: ['416', '604', '514', '780'] },
  AU: { code: '+61', localLen: 9, mobilePrefix: ['4'] },
  DE: { code: '+49', localLen: 11, mobilePrefix: ['15', '16', '17'] },
  FR: { code: '+33', localLen: 9, mobilePrefix: ['6', '7'] },
  JP: { code: '+81', localLen: 10, mobilePrefix: ['70', '80', '90'] },
  BR: { code: '+55', localLen: 11, mobilePrefix: ['11', '21', '31'] },
};

export const SUPPORTED_COUNTRIES = Object.keys(COUNTRY_DIAL);

export function generatePhoneNumber(country = 'US'): string {
  const c = COUNTRY_DIAL[country] ?? COUNTRY_DIAL.US!;
  const prefix = c.mobilePrefix[Math.floor(Math.random() * c.mobilePrefix.length)]!;
  const remaining = c.localLen - prefix.length;
  return `${c.code} ${prefix}${randomDigits(remaining)}`;
}

/**
 * One-call helper: build a fresh identity bundle suitable for a new
 * `PhoneInstance`. Caller can override any field afterwards.
 */
export function generateIdentity(opts: {
  brand: string;
  templateBuildId: string;
  country?: string;
}) {
  return {
    imei: generateImei(opts.brand),
    imsi: generateImsi(),
    androidId: generateAndroidId(),
    serialNumber: generateSerialNumber(opts.brand),
    macWifi: generateMacAddress(),
    macBluetooth: generateBluetoothMac(),
    macEthernet: generateMacAddress(),
    buildNumber: generateBuildNumber(opts.templateBuildId, opts.brand),
    phoneNumber: generatePhoneNumber(opts.country),
  };
}
