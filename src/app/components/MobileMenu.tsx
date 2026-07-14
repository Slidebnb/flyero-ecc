"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

export type MobileMenuItem = {
  href: string;
  label: string;
};

export function MobileMenu({
  items,
  cta,
  showLogout = false,
}: {
  items: MobileMenuItem[];
  cta?: MobileMenuItem;
  showLogout?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <div className="flyeroMobileMenu">
      <button
        type="button"
        className="flyeroMobileMenuButton"
        aria-expanded={open}
        aria-controls="flyero-mobile-menu-panel"
        aria-label={open ? "Menü schließen" : "Menü öffnen"}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>
      {open ? <button type="button" className="flyeroMobileMenuBackdrop" aria-label="Menü schließen" onClick={closeMenu} /> : null}
      {open ? (
        <div id="flyero-mobile-menu-panel" className="flyeroMobileMenuPanel" role="dialog" aria-label="Navigation">
          <nav>
            {items.map((item) => (
              <Link href={item.href} key={item.href} onClick={closeMenu}>
                {item.label}
              </Link>
            ))}
            {cta ? (
              <Link className="flyeroMobileMenuCta" href={cta.href} onClick={closeMenu}>
                {cta.label}
              </Link>
            ) : null}
            {showLogout ? (
              <form action="/api/auth/logout" method="post">
                <button type="submit">Abmelden</button>
              </form>
            ) : null}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
