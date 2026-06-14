"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const APPLICATION_FORM_FIELDS = [
  { id: "brandName", label: "Brand Name", placeholder: "Old Forester" },
  {
    id: "classType",
    label: "Class / Type",
    placeholder: "Kentucky Straight Bourbon Whisky",
  },
  {
    id: "alcoholContent",
    label: "Alcohol Content",
    placeholder: "43% ALC./VOL. (86 PROOF)",
  },
  { id: "netContents", label: "Net Contents", placeholder: "750 mL" },
  {
    id: "producerName",
    label: "Producer / Bottler",
    placeholder: "Brown-Forman Distillery, Louisville, KY",
  },
  {
    id: "beverageType",
    label: "Beverage Type",
    placeholder: "Distilled Spirits",
  },
] as const;

export type ApplicationFormFieldId =
  (typeof APPLICATION_FORM_FIELDS)[number]["id"];

export const emptyApplicationFormState: Record<ApplicationFormFieldId, string> =
  {
    brandName: "",
    classType: "",
    alcoholContent: "",
    netContents: "",
    producerName: "",
    beverageType: "",
  };

export function ApplicationFieldsSection({
  values,
  onChange,
  idPrefix = "",
}: {
  values: Record<ApplicationFormFieldId, string>;
  onChange: (id: ApplicationFormFieldId, value: string) => void;
  idPrefix?: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 font-medium text-lg">Application fields</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {APPLICATION_FORM_FIELDS.map((field) => {
          const fieldId = `${idPrefix}${field.id}`;

          return (
            <div className="grid gap-2" key={field.id}>
              <Label htmlFor={fieldId}>{field.label}</Label>
              <Input
                id={fieldId}
                name={field.id}
                onChange={(event) => onChange(field.id, event.target.value)}
                placeholder={field.placeholder}
                required
                value={values[field.id]}
              />
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-muted-foreground text-xs leading-relaxed">
        The TTB government warning is verified automatically against the
        mandated Surgeon General statement — it is not entered here.
      </p>
    </section>
  );
}

export function appendApplicationFields(
  formData: FormData,
  values: Record<ApplicationFormFieldId, string>
) {
  for (const field of APPLICATION_FORM_FIELDS) {
    formData.append(field.id, values[field.id]);
  }
}
