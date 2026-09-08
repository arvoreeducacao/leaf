# Contributing to Leaf

Thanks for looking. Before anything else, the honest framing:

**Leaf is built for Árvore.** It is a real product used every day by a real
company, and that is what drives what gets built. Contributions are welcome and
we are glad you are here, but reviews happen when there is time, and we may turn
down a change that is good on its own and still wrong for the product we are
running. No promises on response times.

If that works for you, here is how it goes.

## Before you write code

For anything larger than a typo, **open an issue first** and describe what you
want to change. It costs you five minutes and can save you a weekend. A pull
request that arrives with no warning and rewrites a subsystem will probably be
declined, not because it is bad but because we cannot take on maintaining it.

Small fixes — a broken link, a wrong translation, an obvious bug with an obvious
fix — go straight to a pull request. No issue needed.

## Running Leaf

```bash
pnpm install
cp .env.example .env.local   # point DATABASE_URL at a MySQL 8 of your own
pnpm dev
```

`pnpm dev` starts three processes: the app on `http://localhost:3000`, an S3
emulator on `4568`, and the collaboration server on `1234`. Migrations run on
boot. Create an account at `/signup` — there is no email verification in
development.

The tests need a real MySQL; there is no in-memory fallback. See the README.

## Before you open the pull request

```bash
pnpm typecheck   # must pass — CI runs exactly this
pnpm test        # needs MySQL
```

House rules that reviewers will otherwise ask you about:

- **No comments in the code.** Names carry the meaning. The exceptions are the
  ones tools demand, like `eslint-disable` or `@ts-ignore`.
- **Both languages.** Every user-facing string lives in `messages/pt-BR.json`
  and `messages/en-US.json`. A string added to only one is a bug.
- **Icons come from `@/components/icons`.** That barrel maps our semantic names
  onto Lucide. Do not import `lucide-react` directly, and do not add another
  icon library.
- **Nothing Árvore-specific.** Anything tied to one installation — a domain, a
  host name, an identity provider, an API key — is read from the environment
  and has a sensible default when absent. A hard-coded `arvore.com.br` will be
  sent back.

## Signing off your commits

Leaf uses the [Developer Certificate of Origin](https://developercertificate.org/).
Every commit needs a `Signed-off-by` line, which `git commit -s` adds for you:

```
Signed-off-by: Your Name <your@email.com>
```

It means one thing: you wrote the change, or you have the right to submit it,
and you are submitting it under this project's licence. You keep the copyright
to what you wrote. There is no separate agreement to sign.

## Licence

Leaf is [AGPL-3.0](LICENSE). Contributions come in under the same licence.

The practical consequence, so nobody is surprised later: if you run a modified
Leaf as a service, the people using it are entitled to that modified source.
That obligation is the point of the licence, not a side effect.

## Security

Do not report vulnerabilities as issues. [SECURITY.md](SECURITY.md) has the
private channels.
