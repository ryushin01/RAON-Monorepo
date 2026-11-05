import { ROLE_LABEL, ROLES } from "@raon/contracts";
import styles from "./auth-form.module.scss";

export function RoleField({ legend }: { legend: string }) {
  return (
    <fieldset className={styles.roles}>
      <legend className={styles.legend}>{legend}</legend>
      {ROLES.map((role, index) => (
        <label key={role} className={styles.role}>
          <input type="radio" name="role" value={role} defaultChecked={index === 0} />
          <span>{ROLE_LABEL[role]}</span>
        </label>
      ))}
    </fieldset>
  );
}
