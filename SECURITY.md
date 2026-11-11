# Security

If you find a way for these games to harm a page that embeds them or its visitors (script injection through an
attribute, a leak of anything outside `chiplets:*` storage, a request to anywhere but the script's own files),
please report it privately with **Report a vulnerability** on this repository's Security tab rather than in a
public issue.

Things that are known and not vulnerabilities:

- A visitor can change their own play-money balance with developer tools. Balances are client-side by design and
  must never be tied to anything of value (see the README).
- The embed has no server, so there is nothing to attack there. Problems with chiplets.win accounts can be
  reported the same way.

What the script does on a page, and how to verify the files you load, is described under "Check what you embed"
in the README.
