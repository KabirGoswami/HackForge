import { useId, useRef, useState, type FormEvent } from "react";
import { ChevronDown, FolderOpen, Plus, X } from "lucide-react";
import "./InvestigationSelector.css";

export interface InvestigationOption {
  id: string;
  title: string;
  reference: string;
  mode?: string;
}

export interface NewInvestigationDetails {
  title: string;
  description: string;
}

interface InvestigationSelectorProps {
  investigations: InvestigationOption[];
  activeInvestigationId: string;
  onSelect: (id: string) => void;
  onCreate: (details: NewInvestigationDetails) => void;
  variant?: "header" | "sidebar";
}

export function InvestigationSelector({
  investigations,
  activeInvestigationId,
  onSelect,
  onCreate,
  variant = "header",
}: InvestigationSelectorProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState("");

  const openCreateDialog = () => {
    setTitle("");
    setDescription("");
    setNameError("");
    dialogRef.current?.showModal();
    nameInputRef.current?.focus();
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = title.trim();
    if (!name) {
      setNameError("Enter an investigation name.");
      nameInputRef.current?.focus();
      return;
    }
    onCreate({ title: name, description: description.trim() });
    dialogRef.current?.close();
  };

  return (
    <div className={`investigation-selector investigation-selector--${variant}`}>
      <label className="investigation-selector-label" htmlFor={`${id}-select`}>
        Active investigation
      </label>
      <div className="investigation-selector-controls">
        <div className="investigation-selector-field">
          <FolderOpen size={15} aria-hidden="true" />
          <select
            id={`${id}-select`}
            value={activeInvestigationId}
            onChange={(event) => onSelect(event.target.value)}
          >
            {investigations.map((investigation) => (
              <option key={investigation.id} value={investigation.id}>
                {investigation.title} ({investigation.reference})
              </option>
            ))}
          </select>
          <ChevronDown size={13} aria-hidden="true" />
        </div>
        <button
          ref={createButtonRef}
          className="investigation-selector-create"
          type="button"
          aria-label="Create investigation"
          title="Create investigation"
          onClick={openCreateDialog}
        >
          <Plus size={17} aria-hidden="true" />
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className="investigation-create-dialog"
        aria-labelledby={`${id}-dialog-title`}
        aria-describedby={`${id}-dialog-description`}
        onClose={() => createButtonRef.current?.focus()}
      >
        <div className="investigation-dialog-heading">
          <div>
            <h2 id={`${id}-dialog-title`}>New investigation</h2>
            <p id={`${id}-dialog-description`}>
              Open a case for both investigation teams.
            </p>
          </div>
          <button
            className="investigation-dialog-close"
            type="button"
            aria-label="Close new investigation"
            onClick={() => dialogRef.current?.close()}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={handleCreate}>
          <div className="investigation-form-field">
            <label htmlFor={`${id}-name`}>Investigation name</label>
            <input
              ref={nameInputRef}
              id={`${id}-name`}
              name="title"
              required
              maxLength={80}
              value={title}
              placeholder="e.g. Operation Nightfall"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? `${id}-name-error` : undefined}
              onChange={(event) => {
                setTitle(event.target.value);
                if (nameError) setNameError("");
              }}
            />
            {nameError && (
              <p className="investigation-form-error" id={`${id}-name-error`} role="alert">
                {nameError}
              </p>
            )}
          </div>
          <div className="investigation-form-field">
            <label htmlFor={`${id}-description`}>
              Description <span>Optional</span>
            </label>
            <textarea
              id={`${id}-description`}
              name="description"
              maxLength={500}
              rows={3}
              value={description}
              placeholder="What are the teams investigating?"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <p className="investigation-dialog-storage">Saved in this browser.</p>
          <div className="investigation-dialog-actions">
            <button
              className="investigation-dialog-cancel"
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <button className="investigation-dialog-submit" type="submit">
              Create investigation
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
