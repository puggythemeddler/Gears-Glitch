import { useEffect } from "react";
import { useRouter } from "next/router";

export default function BackofficePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin");
  }, [router]);
  return null;
}
