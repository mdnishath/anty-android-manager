import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import {
  ArrowLeft,
  Smartphone,
  Cpu,
  Monitor,
  Battery,
  Zap,
  Layers,
  Hash,
  Calendar,
  Building2,
  ShieldCheck,
  Copy,
  Check,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/cn';
import { PHONE_TEMPLATES, type PhoneTemplate } from '@/data/phoneTemplates';

export default function PhoneDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const template = id ? PHONE_TEMPLATES.find((t) => t.id === id) ?? null : null;

  if (!template) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Smartphone}
          title="Phone not found"
          description={`No template matches "${id}". It may have been removed.`}
          action={
            <Button onClick={() => navigate('/phones')}>
              <ArrowLeft className="h-4 w-4" /> Back to Phones
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-bg-elev/50 backdrop-blur">
        <div className="flex items-center gap-2 px-6 pt-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/phones/new')}>
            <ArrowLeft className="h-4 w-4" /> Back to templates
          </Button>
        </div>
        <Hero template={template} onUse={() => navigate(`/phones/new?template=${template.id}`)} />
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto grid max-w-5xl gap-4 p-6 md:grid-cols-2">
          <HardwareSection template={template} />
          <DisplaySection template={template} />
          <BatterySection template={template} />
          <SoftwareSection template={template} />
          <IdentitySection template={template} />
        </div>
      </div>
    </div>
  );
}

function Hero({ template, onUse }: { template: PhoneTemplate; onUse: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-6 px-6 py-5">
      <DeviceShowcase template={template} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-fg-subtle">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: template.brandColor }}
          />
          {template.brand}
          <span>·</span>
          <span>{template.releaseYear}</span>
          <span>·</span>
          <span className="capitalize">{template.formFactor}</span>
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-fg">{template.model}</h1>
        <p className="mt-2 max-w-xl text-sm text-fg-muted">
          {shortenSoc(template.soc)} · {template.ramGb} GB RAM · {template.storageGb} GB storage ·{' '}
          {template.display.sizeInches}″ {template.display.panel} at {template.display.refreshRateHz}Hz
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {template.tags.map((tag) => (
            <Badge key={tag} variant="muted" size="sm">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={onUse}>
            <Play className="h-4 w-4" /> Use this template
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeviceShowcase({ template }: { template: PhoneTemplate }) {
  const { widthPx, heightPx } = template.display;
  const aspect = widthPx / heightPx;
  const previewHeight = template.formFactor === 'foldable' ? 150 : 180;
  const previewWidth = Math.round(previewHeight * aspect);

  return (
    <div
      className="relative grid h-56 w-72 shrink-0 place-items-center overflow-hidden rounded-xl border border-border"
      style={{
        background: `radial-gradient(circle at center, ${template.brandColor}33 0%, ${template.brandColor}0d 55%, transparent 80%), hsl(var(--bg))`,
      }}
    >
      <div
        className="relative overflow-hidden rounded-2xl border-[3px] shadow-2xl"
        style={{
          width: previewWidth,
          height: previewHeight,
          borderColor: template.brandColor,
          background: `linear-gradient(160deg, ${template.brandColor}cc 0%, ${template.brandColor}66 60%, ${template.brandColor}33 100%)`,
        }}
      >
        <div
          className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full"
          style={{ backgroundColor: '#00000055' }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 text-center text-white/90">
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
            {template.brand}
          </span>
          <span className="text-sm font-semibold leading-tight">
            {template.model.replace(template.brand, '').trim() || template.model}
          </span>
        </div>
        {template.formFactor === 'foldable' && (
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/30" />
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: typeof Cpu;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-lg border border-border bg-bg-elev p-5', className)}>
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-fg-subtle" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-muted">{title}</h2>
      </div>
      <dl className="space-y-2.5">{children}</dl>
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-2 last:border-b-0 last:pb-0">
      <dt className="text-xs uppercase tracking-wide text-fg-subtle">{label}</dt>
      <dd
        className={cn(
          'min-w-0 truncate text-right text-sm text-fg',
          mono && 'font-mono text-[12px]',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function HardwareSection({ template }: { template: PhoneTemplate }) {
  return (
    <Section title="Hardware" icon={Cpu}>
      <Row label="SoC" value={template.soc} />
      <Row
        label="CPU"
        value={`${template.cpu.cores} cores @ ${template.cpu.maxClockGhz} GHz`}
      />
      <Row label="ABI" value={template.cpu.abi} mono />
      <Row label="GPU" value={template.gpu} />
      <Row label="RAM" value={`${template.ramGb} GB`} />
      <Row label="Storage" value={`${template.storageGb} GB`} />
    </Section>
  );
}

function DisplaySection({ template }: { template: PhoneTemplate }) {
  const d = template.display;
  return (
    <Section title="Display" icon={Monitor}>
      <Row label="Size" value={`${d.sizeInches}″`} />
      <Row label="Panel" value={d.panel} />
      <Row label="Resolution" value={`${d.widthPx} × ${d.heightPx}`} mono />
      <Row label="Density" value={`${d.densityDpi} dpi`} />
      <Row label="Refresh rate" value={`${d.refreshRateHz} Hz`} />
    </Section>
  );
}

function BatterySection({ template }: { template: PhoneTemplate }) {
  return (
    <Section title="Battery" icon={Battery}>
      <Row label="Capacity" value={`${template.battery.capacityMah} mAh`} />
      <Row
        label="Fast charge"
        value={
          <span className="inline-flex items-center gap-1">
            <Zap className="h-3 w-3" /> {template.battery.fastChargeW} W
          </span>
        }
      />
    </Section>
  );
}

function SoftwareSection({ template }: { template: PhoneTemplate }) {
  const a = template.android;
  return (
    <Section title="Software" icon={Layers}>
      <Row label="Android" value={`${a.version} (API ${a.apiLevel})`} />
      <Row label="OEM skin" value={a.skin} />
      <Row
        label="Security patch"
        value={
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-success" /> {a.securityPatch}
          </span>
        }
      />
      <Row label="Build ID" value={a.buildId} mono />
    </Section>
  );
}

function IdentitySection({ template }: { template: PhoneTemplate }) {
  const b = template.build;
  return (
    <Section title="Build Identity" icon={Hash} className="md:col-span-2">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Row label="Manufacturer" value={<MonoTag>{b.manufacturer}</MonoTag>} />
        <Row label="Brand" value={<MonoTag>{b.productBrand}</MonoTag>} />
        <Row label="Product" value={<MonoTag>{b.productName}</MonoTag>} />
        <Row label="Device" value={<MonoTag>{b.productDevice}</MonoTag>} />
        <Row label="Model" value={<MonoTag>{b.productModel}</MonoTag>} />
        <Row
          label="Release year"
          value={
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {template.releaseYear}
            </span>
          }
        />
      </div>
      <Fingerprint value={b.fingerprint} />
    </Section>
  );
}

function MonoTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-bg-elev-2 px-1.5 py-0.5 font-mono text-[11px] text-fg">
      {children}
    </span>
  );
}

function Fingerprint({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable */
    }
  };
  return (
    <div className="mt-3 rounded-md border border-border bg-bg p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-fg-subtle">
          <Building2 className="h-3 w-3" /> ro.build.fingerprint
        </span>
        <button
          type="button"
          onClick={onCopy}
          className={cn(
            'inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors',
            copied
              ? 'bg-success/15 text-success'
              : 'bg-bg-elev-2 text-fg-muted hover:bg-bg-elev-2/70 hover:text-fg',
          )}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <code className="block break-all font-mono text-[11px] leading-relaxed text-fg-muted">
        {value}
      </code>
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
