import { debugBadge } from "../../dev/uiDebug";

export interface Toast {
  id: string;
  message: string;
}

export function ToastHost({ toasts }: { toasts: Toast[] }): JSX.Element {
  return (
    <div className="toast-host" data-ui="overlay-toast-host">
      {debugBadge("ToastHost", "src/components/common/ToastHost.tsx")}
      {toasts.map((toast) => (
        <div key={toast.id} className="toast" data-ui="toast-item">
          {toast.message}
        </div>
      ))}
    </div>
  );
}
