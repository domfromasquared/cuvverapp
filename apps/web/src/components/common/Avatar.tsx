import { useMemo, useState } from "react";

function initialsFrom(name?: string | null, email?: string | null): string {
  const base = (name ?? "").trim() || (email ?? "").trim() || "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return (base.slice(0, 2) || "?").toUpperCase();
}

export function Avatar({
  name,
  email,
  src,
  size = "md"
}: {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  size?: "sm" | "md";
}): JSX.Element {
  const [broken, setBroken] = useState(false);
  const initials = useMemo(() => initialsFrom(name, email), [name, email]);
  const className = `avatar ${size === "sm" ? "avatar-sm" : "avatar-md"}`;
  const showImage = Boolean(src) && !broken;

  return (
    <span className={className} aria-hidden="true">
      {showImage ? (
        <img src={src ?? ""} alt="" className="avatar-image" onError={() => setBroken(true)} />
      ) : (
        <span className="avatar-fallback">{initials}</span>
      )}
    </span>
  );
}
