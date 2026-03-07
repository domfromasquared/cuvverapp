import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { getCurrentUser, getSession } from "../auth/session";
import { ensureProfile, listMyHouseholds, createHousehold, getHouseholdMembers } from "../services/householdApi";
import { useAppStore } from "../state/appStore";
import { useUi } from "../app/providers";
import { debugBadge } from "../dev/uiDebug";

const FALLBACK_TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney"
];

function getTimezoneOptions(): string[] {
  const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  if (typeof supportedValuesOf === "function") {
    const timezones = supportedValuesOf("timeZone");
    if (timezones.length > 0) return timezones;
  }
  return FALLBACK_TIMEZONES;
}

function getDefaultTimezone(options: string[]): string {
  const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return resolved && options.includes(resolved) ? resolved : "America/Los_Angeles";
}

export function BootstrapPage(): JSX.Element {
  const navigate = useNavigate();
  const { pushToast } = useUi();
  const { setProfile, setHousehold, setRole, setMembers } = useAppStore();
  const [needsHousehold, setNeedsHousehold] = useState(false);
  const [loading, setLoading] = useState(true);
  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);
  const defaultTimezone = useMemo(() => getDefaultTimezone(timezoneOptions), [timezoneOptions]);

  useEffect(() => {
    let mounted = true;

    async function run(): Promise<void> {
      try {
        const session = await getSession();
        if (!session) {
          navigate("/auth", { replace: true });
          return;
        }

        const user = await getCurrentUser();
        if (!user) {
          navigate("/auth", { replace: true });
          return;
        }

        const profile = await ensureProfile(user);
        if (!mounted) return;
        setProfile(profile);

        const households = await listMyHouseholds();
        if (!mounted) return;

        if (households.length === 0) {
          setNeedsHousehold(true);
          return;
        }

        const selected = households[0];
        setHousehold(selected);
        setRole(selected.role);
        setMembers(await getHouseholdMembers(selected.id));
        navigate("/app/schedule", { replace: true });
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "Unable to bootstrap session.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void run();

    return () => {
      mounted = false;
    };
  }, [navigate, pushToast, setHousehold, setMembers, setProfile, setRole]);

  if (loading && !needsHousehold) {
    return (
      <div className="app page stack" data-ui="page-bootstrap">
        {debugBadge("BootstrapPage", "src/pages/BootstrapPage.tsx")}
        <Card>
          <h2 className="section-title">Preparing Cuvver</h2>
          <p className="caption">Loading your household workspace...</p>
        </Card>
      </div>
    );
  }

  if (needsHousehold) {
    return (
      <div className="app page stack" data-ui="page-bootstrap-needs-household">
        {debugBadge("BootstrapPage", "src/pages/BootstrapPage.tsx")}
        <Card data-ui="bootstrap-household-onboarding">
          <h2 className="section-title">Create your household</h2>
          <p className="caption">Set up once and keep care continuity consistent.</p>
          <form
            className="stack"
            data-ui="bootstrap-household-create-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const nameInput = form.elements.namedItem("name") as HTMLInputElement;
              const timezoneInput = form.elements.namedItem("timezone") as HTMLSelectElement;

              if (!nameInput.value.trim()) return;

              try {
                await createHousehold({
                  household_name: nameInput.value.trim(),
                  timezone: timezoneInput.value || "America/Los_Angeles"
                });

                const households = await listMyHouseholds();
                const selected = households[0];
                if (!selected) throw new Error("Household setup failed");
                setHousehold(selected);
                setRole(selected.role);
                setMembers(await getHouseholdMembers(selected.id));
                pushToast("Household created.");
                navigate("/app/schedule", { replace: true });
              } catch (error) {
                pushToast(error instanceof Error ? error.message : "Unable to create household.");
              }
            }}
          >
            <div className="form-row">
              <label htmlFor="household-name">Household name</label>
              <input id="household-name" className="input" name="name" required placeholder="Hartley Household" />
            </div>
            <div className="form-row">
              <label htmlFor="household-timezone">Timezone</label>
              <select id="household-timezone" className="select" name="timezone" defaultValue={defaultTimezone}>
                {timezoneOptions.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Create household</Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="app page stack" data-ui="page-bootstrap-empty">
      {debugBadge("BootstrapPage", "src/pages/BootstrapPage.tsx")}
    </div>
  );
}
