"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SITE } from "@/lib/site";
import { Logo, MenuIcon } from "./icons";

const pillLink = "block rounded-full px-4 py-1.5 text-sm transition-colors";
const menuLink = "block rounded-2xl px-4 py-2.5 text-[15px] font-medium transition-colors hover:bg-white/10";

export function Nav() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <nav
        aria-label={SITE.labels.mainNav}
        className="relative grid grid-cols-[1fr_auto_1fr] items-center px-5 pt-5 md:px-10 md:pt-6"
      >
        <a
          href="#"
          aria-label={SITE.labels.home}
          className="flex items-center gap-2.5 justify-self-start font-display text-[15px] font-black tracking-[0.04em]"
        >
          <Logo className="h-4 w-5 text-[color:var(--accent)] transition-colors duration-700" />
          <span aria-hidden="true">{SITE.name}</span>
        </a>

        <ul className="hidden items-center gap-1 rounded-full border border-white/25 bg-white/15 p-1 backdrop-blur-md md:flex">
          {SITE.nav.map((link, i) => (
            <li key={link.label}>
              <a
                href={link.href}
                aria-current={i === 0 ? "page" : undefined}
                className={
                  i === 0
                    ? `${pillLink} bg-white font-semibold text-ink`
                    : `${pillLink} font-medium text-white/90 hover:bg-white/15 hover:text-white`
                }
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="col-start-3 flex items-center gap-4 justify-self-end md:gap-6">
          <a href={SITE.play.href} className="text-sm font-semibold transition-opacity hover:opacity-75">
            {SITE.play.label}
          </a>
          <button
            ref={button}
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? SITE.labels.closeMenu : SITE.labels.openMenu}
            onClick={() => setOpen((value) => !value)}
            className="grid size-9 place-items-center rounded-full transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
          >
            <MenuIcon open={open} />
          </button>
        </div>

        <div
          ref={panel}
          id={menuId}
          hidden={!open}
          className="absolute top-full right-5 mt-3 w-60 rounded-3xl border border-white/20 bg-ink/75 p-2 backdrop-blur-xl md:right-10"
        >
          {/* On small screens the pill's links live here. */}
          <ul className="md:hidden">
            {SITE.nav.map((link, i) => (
              <li key={link.label}>
                <a href={link.href} onClick={close} aria-current={i === 0 ? "page" : undefined} className={menuLink}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <hr className="mx-4 my-2 border-white/15 md:hidden" />
          <ul>
            {SITE.menuExtras.map((link) => (
              <li key={link.label}>
                <a href={link.href} onClick={close} className={`${menuLink} text-white/80`}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}
