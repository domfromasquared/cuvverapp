import { useEffect, useState } from "react";
import { resolveAvatarUrl } from "../services/profileApi";

type AvatarIdentity = {
  user_id: string;
  avatar_path?: string | null;
  avatar_url?: string | null;
};

export function useAvatarUrls(people: AvatarIdentity[]): Map<string, string | null> {
  const [urlsByUser, setUrlsByUser] = useState<Map<string, string | null>>(new Map());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = new Map<string, string | null>();
      await Promise.all(
        people.map(async (person) => {
          try {
            const url = await resolveAvatarUrl({
              avatar_path: person.avatar_path ?? null,
              avatar_url: person.avatar_url ?? null
            });
            next.set(person.user_id, url);
          } catch {
            next.set(person.user_id, person.avatar_url ?? null);
          }
        })
      );
      if (!cancelled) setUrlsByUser(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [people]);

  return urlsByUser;
}
