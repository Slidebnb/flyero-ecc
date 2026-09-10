"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function FooterColumn({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const closeOnMobile = window.setTimeout(() => {
      if (window.matchMedia("(max-width: 820px)").matches) setOpen(false);
    }, 0);
    return () => window.clearTimeout(closeOnMobile);
  }, []);

  return (
    <details className="mkFooterGroup" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{title}</summary>
      <nav className="mkFooterGroupLinks" aria-label={title}>
        {links.map(([label, href]) => (
          href.endsWith(".pdf") ? (
            <a key={href} href={href} download>
              {label}
            </a>
          ) : (
            <Link key={href} href={href}>
              {label}
            </Link>
          )
        ))}
      </nav>
    </details>
  );
}
