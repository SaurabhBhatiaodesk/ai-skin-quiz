import { SaveBar } from "@shopify/app-bridge-react";

export default function UnsavedChangesBar({ id, dirty, pending, disabled = false, onSave, onDiscard }: {
  id: string; dirty: boolean; pending: boolean; disabled?: boolean;
  onSave: () => void; onDiscard: () => void;
}) {
  return <SaveBar id={id} open={dirty}>
    <button variant="primary" disabled={pending || disabled} onClick={onSave}>{pending ? "Saving..." : "Save"}</button>
    <button disabled={pending} onClick={onDiscard}>Discard</button>
  </SaveBar>;
}
