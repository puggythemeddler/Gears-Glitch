import React, { useEffect, useState } from "react";
import { isCustomerLoggedIn } from "@/lib/api";
import { usePageTitle } from "@/lib/use-page-title";

export default function AccountPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  usePageTitle("My account - Gear&Glitch");

  useEffect(() => {
    const check = isCustomerLoggedIn();
    setLoggedIn(check);
    if (check) window.location.href = "/dashboard";
  }, []);

  if (loggedIn) return null;

  return (
    <>
      <h1>Account</h1>
      <p className="muted">Please <a href="/login?redirect=/dashboard">sign in</a> to access your account.</p>
    </>
  );
}
