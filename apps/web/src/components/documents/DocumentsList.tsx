import type { DocumentRecord } from "../../types/domain";
import { formatDateTime } from "../../utils/dates";
import { Button } from "../common/Button";
import { debugBadge } from "../../dev/uiDebug";

export function DocumentsList({
  documents,
  canDelete,
  onOpen,
  onDelete
}: {
  documents: DocumentRecord[];
  canDelete: boolean;
  onOpen: (doc: DocumentRecord) => void;
  onDelete: (doc: DocumentRecord) => void;
}): JSX.Element {
  return (
    <div className="list" data-ui="module-documents-list">
      {debugBadge("DocumentsList", "src/components/documents/DocumentsList.tsx")}
      {documents.map((doc) => (
        <article className="list-item" key={doc.id} data-ui="module-documents-list-item">
          <h3 className="title-tight">{doc.title}</h3>
          <p className="caption">
            {doc.file_name} · {formatDateTime(doc.created_at)}
          </p>
          <div className="actions actions-spaced">
            <Button variant="ghost" onClick={() => onOpen(doc)}>
              Open
            </Button>
            {canDelete ? (
              <Button variant="danger" onClick={() => onDelete(doc)}>
                Delete
              </Button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
