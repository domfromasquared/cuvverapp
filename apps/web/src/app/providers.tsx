import { createContext, useContext, useMemo, useState } from "react";
import { AppStoreProvider } from "../state/appStore";
import { ToastHost, type Toast } from "../components/common/ToastHost";
import { debugBadge } from "../dev/uiDebug";

interface UiContextValue {
  pushToast: (message: string) => void;
}

const UiContext = createContext<UiContextValue | null>(null);

function UiProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const value = useMemo<UiContextValue>(
    () => ({
      pushToast(message) {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setToasts((prev) => [...prev, { id, message }]);
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 3200);
      }
    }),
    []
  );

  return (
    <UiContext.Provider value={value}>
      <div data-ui="provider-ui">
        {debugBadge("UiProvider", "src/app/providers.tsx")}
        {children}
      </div>
      <ToastHost toasts={toasts} />
    </UiContext.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <AppStoreProvider>
      <UiProvider>{children}</UiProvider>
    </AppStoreProvider>
  );
}

export function useUi(): UiContextValue {
  const context = useContext(UiContext);
  if (!context) throw new Error("useUi must be used inside Providers");
  return context;
}
