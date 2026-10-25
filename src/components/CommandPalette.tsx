import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../session";
import { Icon, type IconName } from "./icons";

type Command = { label: string; hint: string; icon: IconName; run: () => void };

/** ⌘K / Ctrl+K palette: jump anywhere or start a symptom search by typing. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const session = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement as HTMLElement;
      setQ("");
      setIndex(0);
    } else restoreRef.current?.focus?.();
  }, [open]);

  const as = (role: "buyer" | "contributor" | "reviewer", path: string) => () => {
    const slug = session.slugForRole(role);
    if (slug && session.role !== role) session.setActor(slug);
    navigate(path);
  };

  const commands = useMemo<Command[]>(() => {
    const base: Command[] = [
      { label: "Find a fix", hint: "Buyer", icon: "search", run: as("buyer", "/playbooks") },
      { label: "Alerts", hint: "Buyer", icon: "bell", run: as("buyer", "/watchlist") },
      { label: "Budget", hint: "Buyer", icon: "users", run: as("buyer", "/team") },
      { label: "Share an incident", hint: "Contributor", icon: "plus", run: as("contributor", "/contribute/new") },
      { label: "My incidents", hint: "Contributor", icon: "folder", run: as("contributor", "/contribute") },
      { label: "Review queue", hint: "Reviewer", icon: "shield", run: as("reviewer", "/review") },
      { label: "Agents", hint: "Agents", icon: "spark", run: () => navigate("/agents") },
      { label: "Connect your agent", hint: "Developers", icon: "spark", run: () => navigate("/connect") },
      { label: "Audit log", hint: "Reviewer", icon: "list", run: as("reviewer", "/review/audit") },
      { label: "How it works", hint: "Learn", icon: "spark", run: () => navigate("/how-it-works") },
      { label: "Trust", hint: "Learn", icon: "lock", run: () => navigate("/trust") },
      { label: "Pricing", hint: "Learn", icon: "tag", run: () => navigate("/pricing") },
      { label: "Demo controls", hint: "Demo", icon: "sliders", run: () => navigate("/demo") },
    ];
    const text = q.trim();
    const filtered = base.filter((c) => c.label.toLowerCase().includes(text.toLowerCase()));
    if (text.length >= 4) {
      filtered.unshift({ label: `Search guides for “${text}”`, hint: "Buyer", icon: "search", run: as("buyer", `/playbooks?q=${encodeURIComponent(text)}`) });
    }
    return filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, session.role]);

  if (!open) return null;
  const choose = (c?: Command) => {
    if (!c) return;
    setOpen(false);
    c.run();
  };
  return (
    <div className="palette-backdrop" onMouseDown={() => setOpen(false)}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <Icon name="search" />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            placeholder="Go to a page, or describe a problem"
            aria-label="Command"
            onChange={(e) => {
              setQ(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, commands.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              }
              if (e.key === "Enter") choose(commands[index]);
            }}
          />
          <kbd>esc</kbd>
        </div>
        <ul className="palette-list" role="listbox">
          {commands.map((c, i) => (
            <li key={c.label} role="option" aria-selected={i === index}>
              <button className={i === index ? "active" : ""} onMouseEnter={() => setIndex(i)} onClick={() => choose(c)}>
                <Icon name={c.icon} />
                <span className="grow">{c.label}</span>
                <span className="palette-hint">{c.hint}</span>
              </button>
            </li>
          ))}
          {commands.length === 0 && <li className="muted small palette-empty">No matches.</li>}
        </ul>
      </div>
    </div>
  );
}
