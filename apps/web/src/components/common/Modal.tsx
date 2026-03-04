import type { PropsWithChildren } from "react";
import { debugBadge } from "../../dev/uiDebug";

export function Modal({ children, onClose }: PropsWithChildren<{ onClose: () => void }>): JSX.Element {
  return (
    <div className="modal-backdrop" onClick={onClose} data-ui="modal-backdrop">
      <div className="modal" onClick={(event) => event.stopPropagation()} data-ui="modal-sheet" role="dialog" aria-modal="true">
        {debugBadge("Modal", "src/components/common/Modal.tsx")}
        {children}
      </div>
    </div>
  );
}
