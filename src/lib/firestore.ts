import { getFirestore, doc, getDoc } from "firebase/firestore";
import { firebaseApp } from "@/lib/firebase";

const firestore = getFirestore(firebaseApp);

export async function getHealthCheck() {
  try {
    const healthDoc = doc(firestore, "health", "status");
    const snapshot = await getDoc(healthDoc);
    if (!snapshot.exists()) {
      return "missing";
    }
    return snapshot.get("state") ?? "unknown";
  } catch (error) {
    return error instanceof Error ? error.message : "error";
  }
}

export { firestore };
