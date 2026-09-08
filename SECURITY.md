# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. A public report tells
everyone about the hole before there is a patch, including the people running
Leaf in production.

Two private channels, either is fine:

- **GitHub Security Advisories** — [open a draft advisory](https://github.com/arvoreeducacao/leaf/security/advisories/new).
  This is the preferred one: it keeps the discussion private until a fix ships,
  and it publishes the advisory for us when we are done.
- **Email** — `guilherme.santiago@arvore.com.br`, for anyone without a GitHub
  account.

Tell us what you found, how to reproduce it, and what an attacker gets out of
it. A proof of concept helps a lot. Please do not test against anyone else's
Leaf instance: run your own, it takes one command.

## What to expect

We will acknowledge your report. Beyond that we make no promises about
timelines: Leaf is built for Árvore's own use and maintained alongside other
work, so a fix lands when it lands.

There is **no bug bounty**. We will credit you in the advisory unless you ask
us not to.

## Supported versions

Only the current `main` branch. Leaf has no release trains and no backports —
if you self-host, track `main`.

## What is out of scope

- Findings from automated scanners with no demonstrated impact
- Missing hardening headers that do not lead to an actual attack
- Anything requiring physical access to a signed-in device
- Vulnerabilities in dependencies that are already public and already fixed
  upstream — open a normal pull request bumping the dependency instead
