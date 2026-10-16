# Legal review required

The privacy policy (`frontend/pages/privacy.tsx`), terms of service
(`frontend/pages/terms.tsx`) and cookie/consent banner
(`frontend/components/CookieConsent.tsx`) shipped with this application are
**drafts/templates only**. They exist so the storefront has the required
surfaces and a working consent mechanism; they are **not legal advice** and have
**not been reviewed by a lawyer**.

Do not advertise or represent this application, or any store using it, as
"compliant" with the Kenya Data Protection Act 2019, the GDPR, or any other
regime until a qualified professional has reviewed and approved the final text.

## Before launch, someone must:

1. Replace every `[BRACKETED]` placeholder in `privacy.tsx` and `terms.tsx`
   (company legal name, registered address, contact emails, retention periods,
   legal bases, recipients, governing law, etc.).
2. Confirm the cookie/consent banner's categories (essential / analytics /
   marketing) match the cookies and third-party tags actually used.
3. Wire any future analytics/marketing scripts to gate on
   `getConsent()` from `frontend/components/CookieConsent.tsx` so nothing
   non-essential loads before consent. **No trackers are currently wired.**
4. Confirm the consent model meets the standard in the target jurisdiction
   (e.g. opt-in vs opt-out, withdrawal, records of consent).
5. Add the two links to every active storefront layout template's footer, not
   just the default. The banner links are already template-independent.
6. Obtain a written sign-off from the reviewing lawyer and record the date.

## What this repository does and does not do

- **Does**: enforce WhatsApp opt-in/opt-out before outbound sends, gate
  owner-level data behind permissions, validate uploads, and provide the
  privacy/terms/consent surfaces above.
- **Does not**: certify legal compliance, guarantee data-subject rights
  workflows (export/erasure) end-to-end, or provide a DPIA. Those require a
  product decision and legal input.
