import { redirect } from "next/navigation";

export default function PreferencesRoot() {
  redirect("/dashboard/preferences/general");
}
