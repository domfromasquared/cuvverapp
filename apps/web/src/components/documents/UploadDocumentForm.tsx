import { useState } from "react";
import { Button } from "../common/Button";
import { debugBadge } from "../../dev/uiDebug";

export function UploadDocumentForm({ onSubmit }: { onSubmit: (file: File, title: string, category: string | null) => Promise<void> }): JSX.Element {
  const [isSubmitting, setSubmitting] = useState(false);

  return (
    <form
      className="stack"
      data-ui="module-upload-document-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const fileInput = form.elements.namedItem("file") as HTMLInputElement;
        const titleInput = form.elements.namedItem("title") as HTMLInputElement;
        const categoryInput = form.elements.namedItem("category") as HTMLInputElement;

        const file = fileInput.files?.[0];
        if (!file || !titleInput.value.trim()) return;

        setSubmitting(true);
        try {
          await onSubmit(file, titleInput.value.trim(), categoryInput.value.trim() || null);
          form.reset();
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {debugBadge("UploadDocumentForm", "src/components/documents/UploadDocumentForm.tsx")}
      <div className="form-row">
        <label htmlFor="doc-title">Title</label>
        <input id="doc-title" className="input" name="title" required />
      </div>
      <div className="form-row">
        <label htmlFor="doc-category">Category</label>
        <input id="doc-category" className="input" name="category" placeholder="General" />
      </div>
      <div className="form-row">
        <label htmlFor="doc-file">File</label>
        <input id="doc-file" className="input" name="file" type="file" required />
      </div>
      <Button type="submit" variant="secondary" disabled={isSubmitting}>
        {isSubmitting ? "Uploading..." : "Upload document"}
      </Button>
    </form>
  );
}
