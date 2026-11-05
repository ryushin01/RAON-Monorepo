import { Button } from "@/shared/ui";
import { logout } from "../api/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="ghost" small>
        로그아웃
      </Button>
    </form>
  );
}
