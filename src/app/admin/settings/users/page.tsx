import Link from "next/link";
import { revalidatePath } from "next/cache";
import { UserRole, UserStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { listInternalUsers, setInternalUserStatus } from "@/lib/settings";

async function saveUserStatus(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN]);
  await setInternalUserStatus({
    userId: String(formData.get("userId")),
    status: String(formData.get("status")) as UserStatus,
    adminUserId: session.id,
  });
  revalidatePath("/admin/settings/users");
}

export default async function UsersSettingsPage() {
  await requireRole([UserRole.ADMIN]);
  const users = await listInternalUsers();
  return (
    <main className="appShell">
      <header className="topbar"><div><p className="eyebrow">Einstellungen</p><h1>Benutzer</h1></div><nav className="nav"><Link href="/admin/settings">Zurueck</Link></nav></header>
      <section className="panel stack widePanel">
        <div className="tableWrap">
          <table><thead><tr><th>E-Mail</th><th>Rolle</th><th>Status</th><th>Aktion</th></tr></thead><tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td><td>{user.role}</td>
                <td>
                  <form action={saveUserStatus}>
                    <input type="hidden" name="userId" value={user.id} />
                    <select name="status" defaultValue={user.status}>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="DISABLED">DISABLED</option>
                      <option value="BANNED">BANNED</option>
                    </select>
                    <button type="submit">Speichern</button>
                  </form>
                </td>
                <td>{user.status === "ACTIVE" ? "Aktiv" : "Inaktiv"}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </section>
    </main>
  );
}
