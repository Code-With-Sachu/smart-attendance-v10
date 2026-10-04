"use client";

import { useAppData } from "@/lib/store/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/profile/profile-form";
import { SettingsPanel } from "@/components/profile/settings-panel";
import { StudentDetails } from "@/components/profile/student-details";
import { FileManager } from "@/components/files/file-manager";

const PROFILE_OWNER = { kind: "profile" } as const;

export default function ProfilePage() {
  const data = useAppData();
  if (!data) return null;
  return (
    <>
      <PageHeader title="Profile" description="Your details appear on the dashboard and in shared reports." />
      <div className="grid gap-5 lg:grid-cols-[1fr_400px] lg:items-start">
        <div className="space-y-5">
          <ProfileForm profile={data.profile} />
          <FileManager
            id="files"
            owner={PROFILE_OWNER}
            title="My files"
            description="Upload as many files as you like — timetables, syllabus, circulars, mark lists. Open any file to edit it. The AI assistant can read and analyse them."
          />
          <StudentDetails data={data} />
        </div>
        <SettingsPanel data={data} />
      </div>
    </>
  );
}
