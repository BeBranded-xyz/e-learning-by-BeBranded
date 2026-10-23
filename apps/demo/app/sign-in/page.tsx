import { DEMO_PERSONAS } from "../../lib/demo-users";
import { signInAs } from "./actions";

export default function SignInPage() {
  return (
    <section aria-labelledby="sign-in-title">
      <h1 id="sign-in-title">Choose a demo user</h1>
      <p>Each user has different roles, so each sees different courses.</p>
      <form action={signInAs}>
        <ul className="demo-personas">
          {Object.entries(DEMO_PERSONAS).map(([key, persona]) => (
            <li key={key}>
              <button type="submit" name="persona" value={key}>
                {persona.label}
              </button>
            </li>
          ))}
          <li>
            <button type="submit" name="persona" value="">
              Sign out
            </button>
          </li>
        </ul>
      </form>
    </section>
  );
}
