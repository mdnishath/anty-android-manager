import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { shortId } from '@/lib/ids';
import { generateIdentity } from '@/lib/identity';
import { DEFAULT_PROXY, type ProxyConfig } from '@/lib/proxy';
import type { PhoneTemplate } from '@/data/phoneTemplates';

export type NetworkType = 'wifi' | 'cellular';
export type LocationMode = 'ip-based' | 'custom';
export type PhoneStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface PhoneIdentity {
  imei: string;
  imsi: string;
  androidId: string;
  serialNumber: string;
  macWifi: string;
  macBluetooth: string;
  macEthernet: string;
  buildNumber: string;
}

export interface PhoneNetwork {
  type: NetworkType;
  phoneNumberMode: 'auto' | 'custom';
  phoneNumber: string;
  country: string;            // ISO-3166-1 alpha-2 (e.g. "US", "BD")
  carrier: string;            // human label
}

export interface PhoneLocation {
  mode: LocationMode;
  lat?: number;
  lng?: number;
  timezone: string;           // IANA tz
  language: string;           // BCP-47
}

/**
 * A created phone instance — references a template by id, captures full
 * fingerprint identity, network, location and proxy config. Persisted to
 * localStorage now; later this is the source of truth synced to the sidecar.
 */
export interface PhoneInstance {
  id: string;
  name: string;
  templateId: string;
  templateSnapshot: PhoneTemplate;

  // Hardware overrides (template defaults to these when missing)
  ramGb: number;
  storageGb: number;
  abi: 'arm64-v8a';

  // Per-phone identity (randomized on create)
  identity: PhoneIdentity;
  network: PhoneNetwork;
  location: PhoneLocation;
  proxy: ProxyConfig;

  // Lifecycle
  tags: string[];
  folder: string;
  notes: string;
  status: PhoneStatus;
  createdAt: number;
}

export interface CreatePhoneInput {
  name: string;
  template: PhoneTemplate;
  ramGb?: number;
  storageGb?: number;
  identity?: Partial<PhoneIdentity>;
  network?: Partial<PhoneNetwork>;
  location?: Partial<PhoneLocation>;
  proxy?: ProxyConfig;
  tags?: string[];
  folder?: string;
  notes?: string;
}

interface PhonesState {
  phones: PhoneInstance[];
  add: (input: CreatePhoneInput) => PhoneInstance;
  addMany: (input: CreatePhoneInput, count: number) => PhoneInstance[];
  remove: (id: string) => void;
  setStatus: (id: string, status: PhoneStatus) => void;
  rename: (id: string, name: string) => void;
  update: (id: string, patch: Partial<PhoneInstance>) => void;
}

/** Build a new instance with sane defaults + randomized identity. */
export function buildPhoneInstance(input: CreatePhoneInput): PhoneInstance {
  const { template } = input;
  const identityDefaults = generateIdentity({
    brand: template.brand,
    templateBuildId: template.android.buildId,
    country: input.network?.country ?? 'US',
  });

  return {
    id: shortId(10),
    name: input.name,
    templateId: template.id,
    templateSnapshot: template,
    ramGb: input.ramGb ?? template.ramGb,
    storageGb: input.storageGb ?? template.storageGb,
    abi: 'arm64-v8a',

    identity: {
      imei: identityDefaults.imei,
      imsi: identityDefaults.imsi,
      androidId: identityDefaults.androidId,
      serialNumber: identityDefaults.serialNumber,
      macWifi: identityDefaults.macWifi,
      macBluetooth: identityDefaults.macBluetooth,
      macEthernet: identityDefaults.macEthernet,
      buildNumber: identityDefaults.buildNumber,
      ...input.identity,
    },

    network: {
      type: input.network?.type ?? 'wifi',
      phoneNumberMode: input.network?.phoneNumberMode ?? 'auto',
      phoneNumber: input.network?.phoneNumber ?? identityDefaults.phoneNumber,
      country: input.network?.country ?? 'US',
      carrier: input.network?.carrier ?? 'Default carrier',
    },

    location: {
      mode: input.location?.mode ?? 'ip-based',
      lat: input.location?.lat,
      lng: input.location?.lng,
      timezone: input.location?.timezone ?? 'America/Los_Angeles',
      language: input.location?.language ?? 'en-US',
    },

    proxy: input.proxy ?? DEFAULT_PROXY,
    tags: input.tags ?? [],
    folder: input.folder ?? 'Default',
    notes: input.notes ?? '',
    status: 'stopped',
    createdAt: Date.now(),
  };
}

export const usePhonesStore = create<PhonesState>()(
  persist(
    (set) => ({
      phones: [],
      add: (input) => {
        const instance = buildPhoneInstance(input);
        set((s) => ({ phones: [instance, ...s.phones] }));
        return instance;
      },
      addMany: (input, count) => {
        const instances: PhoneInstance[] = [];
        for (let i = 0; i < count; i++) {
          const suffix = count === 1 ? '' : ` #${i + 1}`;
          instances.push(buildPhoneInstance({ ...input, name: input.name + suffix }));
        }
        set((s) => ({ phones: [...instances, ...s.phones] }));
        return instances;
      },
      remove: (id) => set((s) => ({ phones: s.phones.filter((p) => p.id !== id) })),
      setStatus: (id, status) =>
        set((s) => ({ phones: s.phones.map((p) => (p.id === id ? { ...p, status } : p)) })),
      rename: (id, name) =>
        set((s) => ({ phones: s.phones.map((p) => (p.id === id ? { ...p, name } : p)) })),
      update: (id, patch) =>
        set((s) => ({ phones: s.phones.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
    }),
    {
      name: 'cp.phones',
      version: 2,
      // Migrate from v1 (just name/template/ram/storage) → v2 (full fingerprint).
      migrate: (state: unknown, version: number) => {
        if (!state || typeof state !== 'object') return state;
        const s = state as { phones?: unknown[] };
        if (!Array.isArray(s.phones)) return state;
        if (version < 2) {
          s.phones = s.phones.map((raw) => {
            const p = raw as Partial<PhoneInstance> & { templateSnapshot: PhoneTemplate };
            if (p.identity && p.network) return p;
            return buildPhoneInstance({
              name: p.name ?? 'Phone',
              template: p.templateSnapshot,
              ramGb: p.ramGb,
              storageGb: p.storageGb,
            });
          });
        }
        return s;
      },
    },
  ),
);
