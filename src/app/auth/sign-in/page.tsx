import { redirect } from "next/navigation";

/** Legacy entry point retained only to avoid breaking existing links. */
export default function SignInPage() {
  redirect("/login");
}
