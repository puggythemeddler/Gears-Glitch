import { useEffect } from "react";
import { useRouter } from "next/router";

export default function OwnerPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin");
  }, [router]);
  return null;
}
