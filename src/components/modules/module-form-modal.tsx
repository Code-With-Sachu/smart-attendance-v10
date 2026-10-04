"use client";

import * as React from "react";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";
import { validateModuleInput, MAX_NAME_LENGTH, type FieldErrors } from "@/lib/validation";
import type { Result } from "@/lib/store/store";

export interface ModuleFormValues {
  name: string;
  number: string;
  color: string;
}

export function ModuleFormModal({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  initial,
  nameLabel,
  namePlaceholder,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  initial: ModuleFormValues;
  nameLabel: string;
  namePlaceholder: string;
  onSubmit: (v: ModuleFormValues) => Result<unknown>;
}) {
  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState<FieldErrors<"name" | "number" | "color" | "form">>({});
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setValues(initial);
      setErrors({});
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function set<K extends keyof ModuleFormValues>(k: K, v: string) {
    const next = { ...values, [k]: v };
    setValues(next);
    if (touched) setErrors(validateModuleInput(next).errors);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const v = validateModuleInput(values);
    if (!v.ok) {
      setErrors(v.errors);
      const firstInvalid = Object.keys(v.errors)[0];
      document.getElementById(`module-${firstInvalid}`)?.focus();
      return;
    }
    const r = onSubmit(values);
    if (!r.ok) setErrors({ form: r.error });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="module-form">
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id="module-form" onSubmit={submit} noValidate className="space-y-5">
        <Field label={nameLabel} htmlFor="module-name" error={errors.name} required>
          <Input
            id="module-name"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={namePlaceholder}
            maxLength={MAX_NAME_LENGTH}
            invalid={!!errors.name}
            aria-describedby={errors.name ? "module-name-error" : undefined}
            autoFocus
            autoComplete="off"
          />
        </Field>
        <Field label="Number" htmlFor="module-number" error={errors.number} hint="Used to order modules (1 comes first)." required>
          <Input
            id="module-number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={values.number}
            onChange={(e) => set("number", e.target.value.replace(/[^\d]/g, ""))}
            placeholder="1"
            className="max-w-[140px] tabular"
            invalid={!!errors.number}
            aria-describedby={errors.number ? "module-number-error" : "module-number-hint"}
          />
        </Field>
        <div className="space-y-2">
          <span id="module-color-label" className="block text-sm font-medium text-ink">
            Colour
          </span>
          <ColorPicker id="module-color" value={values.color} onChange={(c) => set("color", c)} />
          {errors.color && <p className="text-xs font-medium text-danger">{errors.color}</p>}
        </div>
        {errors.form && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {errors.form}
          </p>
        )}
      </form>
    </Modal>
  );
}
