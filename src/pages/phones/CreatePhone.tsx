import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Cpu,
  MemoryStick,
  Monitor,
  Battery,
  ArrowLeft,
  Wand2,
  Minus,
  Plus,
  Shuffle,
  ClipboardPaste,
  Wifi,
  Signal,
  Globe2,
  Phone,
  Fingerprint,
  HardDrive,
  Server,
  Smartphone,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { slugify } from '@/lib/ids';
import {
  generateIdentity,
  generatePhoneNumber,
  generateMacAddress,
  generateBuildNumber,
  generateImei,
  generateImsi,
  SUPPORTED_COUNTRIES,
} from '@/lib/identity';
import {
  parseProxyUrl,
  formatProxyUrl,
  extractProxyTokens,
  type ProxyConfig,
  type ProxyProtocol,
} from '@/lib/proxy';
import { usePhonesStore } from '@/store/phones';
import {
  PHONE_TEMPLATES,
  BRANDS,
  type PhoneTemplate,
  type FormFactor,
} from '@/data/phoneTemplates';
import type { PhoneIdentity, PhoneNetwork, PhoneLocation } from '@/store/phones';

type TabKey = 'general' | 'proxy' | 'device' | 'extra';
type FormFilter = 'all' | FormFactor;

const RAM_OPTIONS = [4, 6, 8, 12, 16];
const STORAGE_OPTIONS = [32, 64, 128, 256, 512, 1024];
const ANDROID_VERSIONS = [
  { version: '15', api: 35 },
  { version: '14', api: 34 },
  { version: '13', api: 33 },
  { version: '12', api: 31 },
  { version: '11', api: 30 },
];
const TIMEZONES = [
  'America/Los_Angeles',
  'America/New_York',
  'America/Chicago',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dhaka',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];
const LANGUAGES = ['en-US', 'en-GB', 'bn-BD', 'hi-IN', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'pt-BR'];

export default function CreatePhone() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const addMany = usePhonesStore((s) => s.addMany);

  const initialId = params.get('template');
  const initialTemplate = initialId
    ? PHONE_TEMPLATES.find((t) => t.id === initialId) ?? null
    : null;

  // ─── Wizard-wide state ───
  const [tab, setTab] = useState<TabKey>(initialTemplate ? 'general' : 'device');
  const [name, setName] = useState(
    initialTemplate ? `${initialTemplate.brand} ${initialTemplate.model}` : '',
  );
  const [count, setCount] = useState(1);
  const [tagsInput, setTagsInput] = useState('');
  const [folder, setFolder] = useState('Default');
  const [notes, setNotes] = useState('');

  const [template, setTemplate] = useState<PhoneTemplate | null>(initialTemplate);
  const [ramGb, setRamGb] = useState<number>(initialTemplate?.ramGb ?? 8);
  const [storageGb, setStorageGb] = useState<number>(initialTemplate?.storageGb ?? 128);
  const [androidVersion, setAndroidVersion] = useState<string>(
    initialTemplate?.android.version ?? '14',
  );

  const [proxy, setProxy] = useState<ProxyConfig>({
    enabled: false,
    protocol: 'http',
    host: '',
    port: 0,
  });

  const [identity, setIdentity] = useState<PhoneIdentity | null>(null);
  const [network, setNetwork] = useState<PhoneNetwork>({
    type: 'wifi',
    phoneNumberMode: 'auto',
    phoneNumber: '',
    country: 'US',
    carrier: 'Default carrier',
  });
  const [location, setLocation] = useState<PhoneLocation>({
    mode: 'ip-based',
    timezone: 'America/Los_Angeles',
    language: 'en-US',
  });

  const [submitting, setSubmitting] = useState(false);

  // When a template is picked, seed identity + name + RAM/storage.
  useEffect(() => {
    if (!template) return;
    if (!name) setName(`${template.brand} ${template.model}`);
    setRamGb(template.ramGb);
    setStorageGb(template.storageGb);
    setAndroidVersion(template.android.version);
    const id = generateIdentity({
      brand: template.brand,
      templateBuildId: template.android.buildId,
      country: network.country,
    });
    setIdentity({
      imei: id.imei,
      imsi: id.imsi,
      androidId: id.androidId,
      serialNumber: id.serialNumber,
      macWifi: id.macWifi,
      macBluetooth: id.macBluetooth,
      macEthernet: id.macEthernet,
      buildNumber: id.buildNumber,
    });
    setNetwork((n) => ({ ...n, phoneNumber: id.phoneNumber }));
  }, [template]); // eslint-disable-line react-hooks/exhaustive-deps

  const canCreate = !!template && !!identity && name.trim().length > 0;
  const tags = useMemo(
    () =>
      tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsInput],
  );

  const onCancel = () => navigate('/phones');
  const onCreate = () => {
    if (!template || !identity || !name.trim()) return;
    setSubmitting(true);
    const instances = addMany(
      {
        name: name.trim(),
        template,
        ramGb,
        storageGb,
        identity,
        network,
        location,
        proxy,
        tags,
        folder,
        notes,
      },
      count,
    );
    toast.success(
      count === 1
        ? `${instances[0]!.name} created`
        : `${count} profiles created`,
      { description: 'Available in the Phones list.' },
    );
    navigate('/phones');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <PageHeader
          title="Create mobile profile"
          subtitle={
            template
              ? `${template.brand} ${template.model} · ${template.android.skin}`
              : 'Pick a device template, configure identity and proxy.'
          }
          className="mt-2"
        />
        <Tabs tab={tab} onChange={setTab} templateSelected={!!template} />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-24 pt-4">
        {tab === 'general' && (
          <GeneralTab
            name={name}
            onName={setName}
            count={count}
            onCount={setCount}
            tagsInput={tagsInput}
            onTagsInput={setTagsInput}
            folder={folder}
            onFolder={setFolder}
            notes={notes}
            onNotes={setNotes}
            template={template}
          />
        )}
        {tab === 'proxy' && <ProxyTab proxy={proxy} onChange={setProxy} />}
        {tab === 'device' && (
          <DeviceTab
            template={template}
            onTemplate={setTemplate}
            ramGb={ramGb}
            onRam={setRamGb}
            storageGb={storageGb}
            onStorage={setStorageGb}
            androidVersion={androidVersion}
            onAndroidVersion={setAndroidVersion}
          />
        )}
        {tab === 'extra' && identity && (
          <ExtraTab
            template={template}
            identity={identity}
            onIdentity={setIdentity}
            network={network}
            onNetwork={setNetwork}
            location={location}
            onLocation={setLocation}
          />
        )}
        {tab === 'extra' && !identity && (
          <NeedTemplateNotice onJump={() => setTab('device')} />
        )}
      </div>

      <Footer
        template={template}
        count={count}
        canCreate={canCreate}
        submitting={submitting}
        onCancel={onCancel}
        onCreate={onCreate}
      />
    </div>
  );
}

// ─────────────────────── Tabs bar ───────────────────────

function Tabs({
  tab,
  onChange,
  templateSelected,
}: {
  tab: TabKey;
  onChange: (t: TabKey) => void;
  templateSelected: boolean;
}) {
  const items: { key: TabKey; label: string; hint?: string; gated?: boolean }[] = [
    { key: 'general', label: 'General' },
    { key: 'proxy', label: 'Proxy' },
    { key: 'device', label: 'Device info' },
    { key: 'extra', label: 'Extra', gated: !templateSelected },
  ];
  return (
    <div className="mt-4 flex items-center gap-1 border-b border-border">
      {items.map((it) => {
        const active = tab === it.key;
        return (
          <button
            key={it.key}
            type="button"
            disabled={it.gated}
            onClick={() => !it.gated && onChange(it.key)}
            className={cn(
              'relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors',
              active ? 'text-accent' : 'text-fg-muted hover:text-fg',
              it.gated && 'cursor-not-allowed opacity-40',
            )}
          >
            {it.label}
            {active && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t bg-accent" />}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────── General tab ───────────────────────

function GeneralTab({
  name,
  onName,
  count,
  onCount,
  tagsInput,
  onTagsInput,
  folder,
  onFolder,
  notes,
  onNotes,
  template,
}: {
  name: string;
  onName: (s: string) => void;
  count: number;
  onCount: (n: number) => void;
  tagsInput: string;
  onTagsInput: (s: string) => void;
  folder: string;
  onFolder: (s: string) => void;
  notes: string;
  onNotes: (s: string) => void;
  template: PhoneTemplate | null;
}) {
  return (
    <TwoColumn template={template}>
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="Profile name">
            <TextInput value={name} onChange={onName} placeholder="My Galaxy S24 Ultra" />
            <Hint>
              Codename: <code className="font-mono text-fg-muted">{slugify(name) || 'phone'}</code>
            </Hint>
          </Field>
          <Field label="Number of profiles">
            <CountStepper value={count} onChange={onCount} min={1} max={50} />
          </Field>
        </div>

        <Field label="Tags" hint="Comma separated. Used for filtering & grouping.">
          <TextInput value={tagsInput} onChange={onTagsInput} placeholder="warmup, instagram, geo:us" />
        </Field>

        <Field label="Folder">
          <TextInput value={folder} onChange={onFolder} placeholder="Default" />
        </Field>

        <Field label="Note" hint={`${notes.length} / 1500`}>
          <textarea
            value={notes}
            onChange={(e) => onNotes(e.target.value.slice(0, 1500))}
            placeholder="Enter a short profile summary"
            rows={4}
            className="w-full resize-none rounded-md border border-border bg-bg-elev px-3 py-2 text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </Field>
      </div>
    </TwoColumn>
  );
}

// ─────────────────────── Proxy tab ───────────────────────

function ProxyTab({
  proxy,
  onChange,
}: {
  proxy: ProxyConfig;
  onChange: (p: ProxyConfig) => void;
}) {
  const [raw, setRaw] = useState(proxy.raw ?? '');
  const [parseError, setParseError] = useState<string | null>(null);
  const tokens = extractProxyTokens(proxy.username);

  const applyRaw = (text: string) => {
    setRaw(text);
    if (!text.trim()) {
      setParseError(null);
      return;
    }
    const result = parseProxyUrl(text);
    if (result.ok) {
      setParseError(null);
      onChange(result.proxy);
    } else {
      setParseError(result.error);
    }
  };

  const setProto = (protocol: ProxyProtocol) => onChange({ ...proxy, protocol });
  const patch = (p: Partial<ProxyConfig>) => onChange({ ...proxy, ...p });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between rounded-lg border border-border bg-bg-elev p-4">
        <div>
          <h3 className="text-sm font-semibold text-fg">Use proxy</h3>
          <p className="mt-0.5 text-xs text-fg-muted">
            Route the phone&apos;s traffic through an external proxy.
          </p>
        </div>
        <Toggle value={proxy.enabled} onChange={(v) => patch({ enabled: v })} />
      </div>

      <fieldset disabled={!proxy.enabled} className={cn(!proxy.enabled && 'pointer-events-none opacity-50')}>
        <Field label="Protocol">
          <SegmentedControl
            value={proxy.protocol}
            onChange={setProto}
            options={[
              { value: 'http', label: 'HTTP' },
              { value: 'https', label: 'HTTPS' },
              { value: 'socks5', label: 'SOCKS5' },
            ]}
          />
        </Field>

        <Field
          label="Paste proxy URL"
          hint="Sticky session tokens in the username are preserved."
        >
          <div className="relative">
            <textarea
              value={raw}
              onChange={(e) => applyRaw(e.target.value)}
              placeholder="http://user__sessid-abc:pass@74.81.81.81:823"
              rows={2}
              spellCheck={false}
              className="w-full resize-none rounded-md border border-border bg-bg-elev px-3 py-2 pr-24 font-mono text-[12px] text-fg outline-none placeholder:text-fg-subtle focus:border-accent focus:ring-1 focus:ring-accent"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  applyRaw(text);
                } catch {
                  toast.error('Clipboard read denied');
                }
              }}
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-bg-elev-2 px-2 py-1 text-[11px] font-medium text-fg-muted hover:text-fg"
            >
              <ClipboardPaste className="h-3 w-3" /> Paste
            </button>
          </div>
          {parseError && <p className="mt-1 text-xs text-danger">{parseError}</p>}
          {!parseError && (tokens.country || tokens.session) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tokens.country && (
                <Badge variant="accent" size="sm">
                  <Globe2 className="mr-1 h-3 w-3" /> Country: {tokens.country}
                </Badge>
              )}
              {tokens.session && (
                <Badge variant="info" size="sm">
                  Session: <code className="ml-1 font-mono">{tokens.session.slice(0, 12)}…</code>
                </Badge>
              )}
            </div>
          )}
        </Field>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Host">
            <TextInput
              value={proxy.host}
              onChange={(v) => syncRaw({ ...proxy, host: v }, onChange, setRaw)}
              placeholder="74.81.81.81"
            />
          </Field>
          <Field label="Port">
            <TextInput
              value={String(proxy.port || '')}
              onChange={(v) =>
                syncRaw({ ...proxy, port: Number(v) || 0 }, onChange, setRaw)
              }
              placeholder="823"
              inputMode="numeric"
            />
          </Field>
          <Field label="Username">
            <TextInput
              value={proxy.username ?? ''}
              onChange={(v) => syncRaw({ ...proxy, username: v }, onChange, setRaw)}
              placeholder="user"
              mono
            />
          </Field>
          <Field label="Password">
            <TextInput
              value={proxy.password ?? ''}
              onChange={(v) => syncRaw({ ...proxy, password: v }, onChange, setRaw)}
              placeholder="••••"
              type="password"
              mono
            />
          </Field>
        </div>

        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={() => toast.info('Proxy reachability check is not wired up yet.')}
          >
            <Server className="h-4 w-4" /> Check proxy
          </Button>
        </div>
      </fieldset>
    </div>
  );
}

function syncRaw(
  next: ProxyConfig,
  onChange: (p: ProxyConfig) => void,
  setRaw: (s: string) => void,
) {
  const url = formatProxyUrl(next);
  onChange({ ...next, raw: url });
  setRaw(url);
}

// ─────────────────────── Device tab ───────────────────────

function DeviceTab({
  template,
  onTemplate,
  ramGb,
  onRam,
  storageGb,
  onStorage,
  androidVersion,
  onAndroidVersion,
}: {
  template: PhoneTemplate | null;
  onTemplate: (t: PhoneTemplate | null) => void;
  ramGb: number;
  onRam: (v: number) => void;
  storageGb: number;
  onStorage: (v: number) => void;
  androidVersion: string;
  onAndroidVersion: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      {template ? (
        <div className="rounded-lg border border-border bg-bg-elev p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 shrink-0 rounded-md"
                style={{
                  background: `linear-gradient(135deg, ${template.brandColor} 0%, ${template.brandColor}80 100%)`,
                }}
              />
              <div>
                <div className="text-xs uppercase tracking-wider text-fg-subtle">Selected device</div>
                <div className="text-sm font-semibold text-fg">
                  {template.brand} {template.model}
                </div>
              </div>
            </div>
            <Badge variant="muted" size="sm">
              <Cpu className="mr-1 h-3 w-3" /> arm64-v8a
            </Badge>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="OS version">
              <Select
                value={androidVersion}
                onChange={onAndroidVersion}
                options={ANDROID_VERSIONS.map((a) => ({
                  value: a.version,
                  label: `Android ${a.version} (API ${a.api})`,
                }))}
              />
            </Field>
            <Field label="RAM" hint={`Template: ${template.ramGb} GB`}>
              <Select
                value={String(ramGb)}
                onChange={(v) => onRam(Number(v))}
                options={RAM_OPTIONS.map((r) => ({ value: String(r), label: `${r} GB` }))}
              />
            </Field>
            <Field label="Storage" hint={`Template: ${template.storageGb} GB`}>
              <Select
                value={String(storageGb)}
                onChange={(v) => onStorage(Number(v))}
                options={STORAGE_OPTIONS.map((s) => ({ value: String(s), label: `${s} GB` }))}
              />
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-fg-muted">
            <Button variant="ghost" size="sm" onClick={() => onTemplate(null)}>
              <Shuffle className="h-3 w-3" /> Change device
            </Button>
          </div>
        </div>
      ) : (
        <TemplatePicker onPick={onTemplate} />
      )}
    </div>
  );
}

function TemplatePicker({ onPick }: { onPick: (t: PhoneTemplate) => void }) {
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState<string>('all');
  const [form, setForm] = useState<FormFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PHONE_TEMPLATES.filter((t) => {
      if (brand !== 'all' && t.brand !== brand) return false;
      if (form !== 'all' && t.formFactor !== form) return false;
      if (!q) return true;
      return (
        t.brand.toLowerCase().includes(q) ||
        t.model.toLowerCase().includes(q) ||
        t.soc.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [query, brand, form]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            type="search"
            placeholder="Search by brand, model, chipset…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-bg-elev pl-9 pr-3 text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
        <SegmentedControl
          value={form}
          onChange={(v) => setForm(v as FormFilter)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'phone', label: 'Phone' },
            { value: 'foldable', label: 'Foldable' },
            { value: 'tablet', label: 'Tablet' },
          ]}
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <FilterChip active={brand === 'all'} onClick={() => setBrand('all')}>
          All <span className="ml-1.5 text-fg-subtle">{PHONE_TEMPLATES.length}</span>
        </FilterChip>
        {BRANDS.map((b) => {
          const c = PHONE_TEMPLATES.filter((t) => t.brand === b).length;
          return (
            <FilterChip key={b} active={brand === b} onClick={() => setBrand(b)}>
              {b} <span className="ml-1.5 text-fg-subtle">{c}</span>
            </FilterChip>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((t) => (
          <TemplateCard key={t.id} template={t} onSelect={() => onPick(t)} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────── Extra tab ───────────────────────

function ExtraTab({
  template,
  identity,
  onIdentity,
  network,
  onNetwork,
  location,
  onLocation,
}: {
  template: PhoneTemplate | null;
  identity: PhoneIdentity;
  onIdentity: (i: PhoneIdentity) => void;
  network: PhoneNetwork;
  onNetwork: (n: PhoneNetwork) => void;
  location: PhoneLocation;
  onLocation: (l: PhoneLocation) => void;
}) {
  const regenerateAll = () => {
    if (!template) return;
    const id = generateIdentity({
      brand: template.brand,
      templateBuildId: template.android.buildId,
      country: network.country,
    });
    onIdentity({
      imei: id.imei,
      imsi: id.imsi,
      androidId: id.androidId,
      serialNumber: id.serialNumber,
      macWifi: id.macWifi,
      macBluetooth: id.macBluetooth,
      macEthernet: id.macEthernet,
      buildNumber: id.buildNumber,
    });
    if (network.phoneNumberMode === 'auto') onNetwork({ ...network, phoneNumber: id.phoneNumber });
    toast.success('New identity generated');
  };

  return (
    <TwoColumn template={template}>
      <div className="space-y-6">
        <Section title="Network" icon={Signal}>
          <Field label="Connection type">
            <SegmentedControl
              value={network.type}
              onChange={(v) => onNetwork({ ...network, type: v as 'wifi' | 'cellular' })}
              options={[
                { value: 'wifi', label: 'Wi-Fi', icon: Wifi },
                { value: 'cellular', label: 'Cellular', icon: Signal },
              ]}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Country">
              <Select
                value={network.country}
                onChange={(v) =>
                  onNetwork({
                    ...network,
                    country: v,
                    phoneNumber:
                      network.phoneNumberMode === 'auto' ? generatePhoneNumber(v) : network.phoneNumber,
                  })
                }
                options={SUPPORTED_COUNTRIES.map((c) => ({ value: c, label: c }))}
              />
            </Field>
            <Field label="Carrier">
              <TextInput
                value={network.carrier}
                onChange={(v) => onNetwork({ ...network, carrier: v })}
                placeholder="T-Mobile, Airtel, Orange…"
              />
            </Field>
          </div>
          <Field label="Phone number">
            <SegmentedControl
              value={network.phoneNumberMode}
              onChange={(v) => {
                const mode = v as 'auto' | 'custom';
                if (mode === 'auto') {
                  onNetwork({ ...network, phoneNumberMode: mode, phoneNumber: generatePhoneNumber(network.country) });
                } else {
                  onNetwork({ ...network, phoneNumberMode: mode });
                }
              }}
              options={[
                { value: 'auto', label: 'Auto-generated' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
            <div className="mt-2 flex items-center gap-2">
              <TextInput
                value={network.phoneNumber}
                onChange={(v) => onNetwork({ ...network, phoneNumber: v })}
                disabled={network.phoneNumberMode === 'auto'}
                placeholder="+1 415 555 0100"
                mono
                className="flex-1"
              />
              {network.phoneNumberMode === 'auto' && (
                <IconRegenerateButton
                  title="Regenerate phone number"
                  onClick={() =>
                    onNetwork({ ...network, phoneNumber: generatePhoneNumber(network.country) })
                  }
                />
              )}
            </div>
          </Field>
        </Section>

        <Section
          title="Identity"
          icon={Fingerprint}
          right={
            <Button variant="ghost" size="sm" onClick={regenerateAll}>
              <Shuffle className="h-3 w-3" /> Regenerate all
            </Button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <RegenerableField
              label="IMEI"
              value={identity.imei}
              onChange={(v) => onIdentity({ ...identity, imei: v })}
              onRegenerate={() =>
                template && onIdentity({ ...identity, imei: generateImei(template.brand) })
              }
            />
            <RegenerableField
              label="IMSI"
              value={identity.imsi}
              onChange={(v) => onIdentity({ ...identity, imsi: v })}
              onRegenerate={() => onIdentity({ ...identity, imsi: generateImsi() })}
            />
            <RegenerableField
              label="Android ID"
              value={identity.androidId}
              onChange={(v) => onIdentity({ ...identity, androidId: v })}
              onRegenerate={() =>
                template &&
                onIdentity({
                  ...identity,
                  androidId: generateIdentity({
                    brand: template.brand,
                    templateBuildId: template.android.buildId,
                  }).androidId,
                })
              }
            />
            <RegenerableField
              label="Serial number"
              value={identity.serialNumber}
              onChange={(v) => onIdentity({ ...identity, serialNumber: v })}
              onRegenerate={() =>
                template &&
                onIdentity({
                  ...identity,
                  serialNumber: generateIdentity({
                    brand: template.brand,
                    templateBuildId: template.android.buildId,
                  }).serialNumber,
                })
              }
            />
            <RegenerableField
              label="Build number"
              value={identity.buildNumber}
              onChange={(v) => onIdentity({ ...identity, buildNumber: v })}
              onRegenerate={() =>
                template &&
                onIdentity({
                  ...identity,
                  buildNumber: generateBuildNumber(template.android.buildId, template.brand),
                })
              }
            />
          </div>
        </Section>

        <Section title="MAC addresses" icon={HardDrive}>
          <div className="grid gap-4 sm:grid-cols-3">
            <RegenerableField
              label="Wi-Fi MAC"
              value={identity.macWifi}
              onChange={(v) => onIdentity({ ...identity, macWifi: v })}
              onRegenerate={() => onIdentity({ ...identity, macWifi: generateMacAddress() })}
            />
            <RegenerableField
              label="Bluetooth MAC"
              value={identity.macBluetooth}
              onChange={(v) => onIdentity({ ...identity, macBluetooth: v })}
              onRegenerate={() => onIdentity({ ...identity, macBluetooth: generateMacAddress() })}
            />
            <RegenerableField
              label="Ethernet MAC"
              value={identity.macEthernet}
              onChange={(v) => onIdentity({ ...identity, macEthernet: v })}
              onRegenerate={() => onIdentity({ ...identity, macEthernet: generateMacAddress() })}
            />
          </div>
        </Section>

        <Section title="Location & locale" icon={Globe2}>
          <Field label="Location">
            <SegmentedControl
              value={location.mode}
              onChange={(v) => onLocation({ ...location, mode: v as 'ip-based' | 'custom' })}
              options={[
                { value: 'ip-based', label: 'IP-based' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
          </Field>
          {location.mode === 'custom' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Latitude">
                <TextInput
                  value={location.lat?.toString() ?? ''}
                  onChange={(v) => onLocation({ ...location, lat: v ? Number(v) : undefined })}
                  placeholder="37.7749"
                  inputMode="decimal"
                />
              </Field>
              <Field label="Longitude">
                <TextInput
                  value={location.lng?.toString() ?? ''}
                  onChange={(v) => onLocation({ ...location, lng: v ? Number(v) : undefined })}
                  placeholder="-122.4194"
                  inputMode="decimal"
                />
              </Field>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Timezone">
              <Select
                value={location.timezone}
                onChange={(v) => onLocation({ ...location, timezone: v })}
                options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
              />
            </Field>
            <Field label="Language">
              <Select
                value={location.language}
                onChange={(v) => onLocation({ ...location, language: v })}
                options={LANGUAGES.map((l) => ({ value: l, label: l }))}
              />
            </Field>
          </div>
        </Section>
      </div>
    </TwoColumn>
  );
}

function NeedTemplateNotice({ onJump }: { onJump: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
      <Smartphone className="mb-2 h-8 w-8 text-fg-subtle" />
      <p className="text-sm font-medium text-fg">Pick a device first</p>
      <p className="mt-1 text-xs text-fg-muted">
        Extra fingerprint fields appear after you choose a template.
      </p>
      <Button size="sm" className="mt-3" onClick={onJump}>
        Go to Device info
      </Button>
    </div>
  );
}

// ─────────────────────── Footer ───────────────────────

function Footer({
  template,
  count,
  canCreate,
  submitting,
  onCancel,
  onCreate,
}: {
  template: PhoneTemplate | null;
  count: number;
  canCreate: boolean;
  submitting: boolean;
  onCancel: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-bg-elev/95 px-6 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {template ? (
            <div className="flex items-center gap-3">
              <div
                className="h-8 w-8 shrink-0 rounded-md"
                style={{
                  background: `linear-gradient(135deg, ${template.brandColor} 0%, ${template.brandColor}90 100%)`,
                }}
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-fg">
                  {template.brand} {template.model}
                </div>
                <div className="truncate text-xs text-fg-muted">
                  {template.cpu.cores} cores · arm64 · Android {template.android.version}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-fg-subtle">Pick a template under Device info.</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onCreate} disabled={!canCreate || submitting}>
            <Wand2 className="h-4 w-4" />
            {submitting
              ? 'Creating…'
              : count > 1
                ? `Create ${count} profiles`
                : 'Create profile'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── Two-column layout helper ───────────────────────

function TwoColumn({ children, template }: { children: ReactNode; template: PhoneTemplate | null }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1fr_280px]">
      <div>{children}</div>
      <SummarySide template={template} />
    </div>
  );
}

function SummarySide({ template }: { template: PhoneTemplate | null }) {
  if (!template) {
    return (
      <aside className="hidden h-fit rounded-lg border border-dashed border-border p-6 text-center text-xs text-fg-subtle md:block">
        <Smartphone className="mx-auto mb-2 h-8 w-8" />
        No device selected.
      </aside>
    );
  }
  return (
    <aside className="hidden h-fit md:block">
      <div
        className="grid h-44 place-items-center rounded-lg border border-border"
        style={{
          background: `radial-gradient(circle at center, ${template.brandColor}33 0%, ${template.brandColor}0d 55%, transparent 80%), hsl(var(--bg))`,
        }}
      >
        <div
          className="relative h-32 w-16 overflow-hidden rounded-[10px] border-[3px] shadow-lg"
          style={{
            borderColor: template.brandColor,
            background: `linear-gradient(160deg, ${template.brandColor}cc 0%, ${template.brandColor}66 60%, ${template.brandColor}33 100%)`,
          }}
        >
          <div className="absolute left-1/2 top-1.5 h-1 w-8 -translate-x-1/2 rounded-full bg-black/30" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1 text-center text-white/90">
            <span className="text-[8px] font-bold uppercase tracking-widest opacity-80">
              {template.brand}
            </span>
            <span className="text-[10px] font-semibold leading-tight">
              {template.model.replace(template.brand, '').trim() || template.model}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-xs">
        <div className="font-semibold text-fg">
          {template.brand} {template.model}
        </div>
        <div className="text-fg-muted">{shortenSoc(template.soc)}</div>
        <div className="text-fg-muted">
          {template.ramGb} GB · {template.storageGb} GB · Android {template.android.version}
        </div>
        <div className="flex flex-wrap gap-1 pt-1">
          {template.tags.slice(0, 3).map((t) => (
            <Badge key={t} variant="muted" size="sm">
              {t}
            </Badge>
          ))}
        </div>
      </div>
    </aside>
  );
}

// ─────────────────────── Tiny form primitives ───────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-fg">{label}</label>
        {hint && <span className="text-[11px] text-fg-subtle">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-[11px] text-fg-subtle">{children}</p>;
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  disabled,
  mono,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'password';
  inputMode?: 'text' | 'numeric' | 'decimal';
  disabled?: boolean;
  mono?: boolean;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      inputMode={inputMode}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'h-9 w-full rounded-md border border-border bg-bg-elev px-3 text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-accent focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50',
        mono && 'font-mono text-[12px]',
        className,
      )}
    />
  );
}

function CountStepper({
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-bg-elev">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        className="flex h-9 w-9 items-center justify-center text-fg-muted hover:text-fg disabled:opacity-30"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^0-9]/g, ''));
          onChange(clamp(n || 1));
        }}
        className="h-9 w-12 bg-transparent text-center text-sm tabular-nums text-fg outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        className="flex h-9 w-9 items-center justify-center text-fg-muted hover:text-fg disabled:opacity-30"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        value ? 'bg-accent' : 'bg-bg-elev-2',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          value ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: typeof Wifi }[];
}) {
  return (
    <div className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-bg-elev p-0.5">
      {options.map((o) => {
        const active = value === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors',
              active ? 'bg-bg-elev-2 text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {Icon && <Icon className="h-3 w-3" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none rounded-md border border-border bg-bg-elev px-3 pr-9 text-sm text-fg outline-none focus:border-accent focus:ring-1 focus:ring-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-bg-elev text-fg">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  right,
  children,
}: {
  title: string;
  icon: typeof Wifi;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-bg-elev p-5">
      <header className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
          <Icon className="h-3.5 w-3.5 text-fg-subtle" />
          {title}
        </h3>
        {right}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function RegenerableField({
  label,
  value,
  onChange,
  onRegenerate,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onRegenerate: () => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <TextInput value={value} onChange={onChange} mono className="flex-1" />
        <IconRegenerateButton title={`Regenerate ${label}`} onClick={onRegenerate} />
      </div>
    </Field>
  );
}

function IconRegenerateButton({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-bg-elev text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
    >
      <Shuffle className="h-3.5 w-3.5" />
    </button>
  );
}

// ─────────────────────── Template grid card (reused) ───────────────────────

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors',
        active
          ? 'border-accent/40 bg-accent/15 text-fg'
          : 'border-border bg-bg-elev text-fg-muted hover:border-border-strong hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

function TemplateCard({
  template,
  onSelect,
}: {
  template: PhoneTemplate;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-bg-elev p-3 text-left transition-all hover:border-accent hover:ring-2 hover:ring-accent/30"
    >
      <DevicePreviewMini template={template} />
      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-fg-subtle">
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: template.brandColor }}
            />
            {template.brand}
          </div>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-fg">{template.model}</h3>
        </div>
        <Badge variant="muted" size="sm">
          {template.releaseYear}
        </Badge>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
        <SpecRow icon={Cpu} value={shortenSoc(template.soc)} />
        <SpecRow icon={MemoryStick} value={`${template.ramGb} / ${template.storageGb} GB`} />
        <SpecRow icon={Monitor} value={`${template.display.sizeInches}" · ${template.display.refreshRateHz}Hz`} />
        <SpecRow icon={Battery} value={`${template.battery.capacityMah} mAh`} />
      </dl>
    </button>
  );
}

function DevicePreviewMini({ template }: { template: PhoneTemplate }) {
  const { widthPx, heightPx } = template.display;
  const aspect = widthPx / heightPx;
  const previewHeight = template.formFactor === 'foldable' ? 110 : 122;
  const previewWidth = Math.round(previewHeight * aspect);

  return (
    <div
      className="relative grid h-36 w-full place-items-center overflow-hidden rounded-lg border border-border"
      style={{
        background: `radial-gradient(circle at center, ${template.brandColor}33 0%, ${template.brandColor}0d 55%, transparent 80%), hsl(var(--bg))`,
      }}
    >
      <div
        className="relative overflow-hidden rounded-[10px] border-[3px] shadow-lg"
        style={{
          width: previewWidth,
          height: previewHeight,
          borderColor: template.brandColor,
          background: `linear-gradient(160deg, ${template.brandColor}cc 0%, ${template.brandColor}66 60%, ${template.brandColor}33 100%)`,
        }}
      >
        <div className="absolute left-1/2 top-1.5 h-1 w-8 -translate-x-1/2 rounded-full bg-black/30" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-2 text-center text-white/90">
          <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">
            {template.brand}
          </span>
          <span className="text-[11px] font-semibold leading-tight">
            {template.model.replace(template.brand, '').trim() || template.model}
          </span>
        </div>
      </div>
    </div>
  );
}

function SpecRow({ icon: Icon, value }: { icon: typeof Cpu; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-fg-muted">
      <Icon className="h-3 w-3 shrink-0 text-fg-subtle" />
      <span className="truncate" title={value}>
        {value}
      </span>
    </div>
  );
}

function shortenSoc(soc: string): string {
  return soc
    .replace('Qualcomm ', '')
    .replace('MediaTek ', '')
    .replace('Google ', '')
    .replace('Samsung ', '')
    .replace(' for Galaxy', '');
}

// keep import-only unused warning quiet — Phone icon used for type
void Phone;
