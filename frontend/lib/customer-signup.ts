import { ApiError } from "./api";

// Policy for the customer tab of /login, which doubles as the sign-up form
// ("No account? Enter a name and we'll create one").
//
// The only failure that may fall through to POST /api/customer/register is a
// credential rejection. /api/customer/login answers 401 for exactly one
// situation - loginCustomer() returning ok:false, i.e. "Invalid email or
// password." - and that is the case the sign-up copy describes.
//
// Everything else must surface to the visitor untouched:
//
//   400  the request itself was malformed (bad email shape, missing field)
//   403  CSRF token missing/invalid
//   429  rate limited / account locked out
//   5xx  the database or server broke
//   no status at all  the request never reached the server (offline, DNS,
//        TLS, connection reset, CORS)
//
// Treating any of those as "no such account" would create accounts as a side
// effect of an outage, and would report a broken server as a wrong password.
//
// Note this is deliberately status-based, not message-based: matching on the
// server's wording would couple the sign-up decision to copy changes, and would
// risk matching a 5xx whose body happens to reuse the same sentence.

// True only for a real HTTP 401 from an endpoint that rejected the credentials.
export function isCredentialRejection(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

// The gate the login form actually consults.
export function shouldAttemptCustomerRegistration(err: unknown, name: string): boolean {
  return !!name && !!name.trim() && isCredentialRejection(err);
}