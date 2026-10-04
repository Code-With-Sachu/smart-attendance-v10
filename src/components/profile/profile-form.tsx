"use client";

import * as React from "react";
import { Camera, Pencil, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Avatar } from "@/components/layout/avatar";
import { store } from "@/lib/store/store";
import { validateImageFile, validateName, ALLOWED_IMAGE_TYPES } from "@/lib/validation";
import type { Profile } from "@/lib/types";

/** Downscale to a 256px square JPEG so the avatar stays small in storage. */
async function toAvatarDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("decode"));
      i.src = url;
    });
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const [editing, setEditing] = React.useState(!profile.name);
  const [values, setValues] = React.useState(profile);
  const [photoError, setPhotoError] = React.useState<string>();
  const [nameError, setNameError] = React.useState<string>();
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!editing) setValues(profile);
  }, [profile, editing]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateImageFile(file);
    if (err) return setPhotoError(err);
    try {
      const dataUrl = await toAvatarDataUrl(file);
      setPhotoError(undefined);
      setValues((v) => ({ ...v, photo: dataUrl }));
      setEditing(true);
    } catch {
      setPhotoError("That image couldn’t be read. Try another file.");
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const err = values.name.trim() ? validateName(values.name) : undefined;
    setNameError(err);
    if (err) return;
    const r = store.updateProfile(values);
    if (r.ok) {
      toast.success("Profile saved");
      setEditing(false);
    } else toast.error(r.error);
  }

  const photoChanged = values.photo !== profile.photo;

  return (
    <Card className="p-5 sm:p-6">
      <form onSubmit={save} noValidate>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative w-fit">
            <Avatar name={values.name} photo={values.photo} className="size-24 text-2xl" />
            {photoChanged && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">Preview</span>}
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                <Camera /> Upload Photo
              </Button>
              {values.photo && (
                <Button variant="ghost" size="sm" onClick={() => { setValues((v) => ({ ...v, photo: null })); setEditing(true); }}>
                  <Trash2 /> Remove
                </Button>
              )}
            </div>
            <input ref={fileRef} type="file" accept={ALLOWED_IMAGE_TYPES.join(",")} className="sr-only" onChange={onFile} aria-label="Upload profile photo" tabIndex={-1} />
            <p className="text-xs text-ink-muted">JPG, PNG or WebP · up to 2 MB</p>
            {photoError && <p role="alert" className="text-xs font-medium text-danger">{photoError}</p>}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="p-name" error={nameError} className="sm:col-span-2">
            <Input id="p-name" value={values.name} disabled={!editing} onChange={(e) => setValues({ ...values, name: e.target.value })} maxLength={60} invalid={!!nameError} autoComplete="name" />
          </Field>
          <Field label="Subject" htmlFor="p-subject">
            <Input id="p-subject" value={values.subject} disabled={!editing} onChange={(e) => setValues({ ...values, subject: e.target.value })} maxLength={60} placeholder="e.g. Computer Science" />
          </Field>
          <Field label="Teacher ID" htmlFor="p-id">
            <Input id="p-id" value={values.teacherId} disabled={!editing} onChange={(e) => setValues({ ...values, teacherId: e.target.value })} maxLength={30} placeholder="e.g. KTU-CS-042" />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          {editing ? (
            <>
              <Button variant="secondary" onClick={() => { setValues(profile); setEditing(false); setNameError(undefined); setPhotoError(undefined); }}>
                <X /> Cancel
              </Button>
              <Button type="submit">
                <Save /> Save Profile
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil /> Edit Profile
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
