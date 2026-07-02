import Link from "next/link";
import type { ReactNode } from "react";
import { FlyeroLogo } from "@/app/marketing";

type PortalNavItem = {
  href: string;
  label: string;
};

type PortalAction = {
  href: string;
  label: string;
};

type StatusTone = "neutral" | "success" | "warning" | "danger";

function toneClass(tone?: StatusTone) {
  return tone ? ` ${tone}` : "";
}

export function PortalShell({
  eyebrow,
  title,
  description,
  navItems,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  navItems: PortalNavItem[];
  children: ReactNode;
}) {
  return (
    <main className="portalShell">
      <aside className="portalSidebar">
        <FlyeroLogo dark />
        <PortalNav items={navItems} />
      </aside>
      <section className="portalMain">
        <PortalHeader eyebrow={eyebrow} title={title} description={description} />
        <div className="portalContent">{children}</div>
      </section>
    </main>
  );
}

export function PortalHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="portalHeader">
      <div className="portalHeaderCopy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </header>
  );
}

export function PortalNav({ items }: { items: PortalNavItem[] }) {
  return (
    <nav className="portalNav" aria-label="Portal Navigation">
      {items.map((item) => (
        <Link href={item.href} key={item.href}>
          {item.label}
        </Link>
      ))}
      <form action="/api/auth/logout" method="post">
        <button type="submit">Abmelden</button>
      </form>
    </nav>
  );
}

export function MetricTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: StatusTone;
}) {
  return (
    <article className={`metricTile${toneClass(tone)}`}>
      <span className="metricTileLabel">{label}</span>
      <strong>{value}</strong>
      <span className="metricTileLine" aria-hidden="true" />
    </article>
  );
}

export function ActionPanel({
  title,
  description,
  actions = [],
  children,
}: {
  title: string;
  description?: string;
  actions?: PortalAction[];
  children?: ReactNode;
}) {
  return (
    <section className="actionPanel">
      <div className="panelTitleRow">
        <span aria-hidden="true" />
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {actions.length ? (
        <div className="portalActions">
          {actions.map((action) => (
            <Link href={action.href} key={action.href}>
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function DataSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="dataSection">
      <div className="dataSectionHeader">
        <div className="panelTitleRow">
          <span aria-hidden="true" />
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: StatusTone;
}) {
  return <span className={`statusBadge${toneClass(tone)}`}>{children}</span>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: PortalAction;
}) {
  return (
    <div className="emptyState">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <Link href={action.href}>{action.label}</Link> : null}
    </div>
  );
}
