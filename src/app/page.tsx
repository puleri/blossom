import { firebaseApp } from "@/lib/firebase";
import { getHealthCheck } from "@/lib/firestore";

export default async function Home() {
  const appName = firebaseApp.name;
  const health = await getHealthCheck();

  return (
    <main>
      <h1>Blossom</h1>
      <p>Next.js App Router starter with Firebase + Firestore bones.</p>
      <ul>
        <li>
          Firebase app loaded: <code>{appName}</code>
        </li>
        <li>
          Firestore status: <code>{health}</code>
        </li>
      </ul>
      <p>
        Configure Firebase credentials in <code>.env.local</code> before running.
      </p>
    </main>
  );
}
