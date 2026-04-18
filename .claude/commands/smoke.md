---
name: smoke
description: Run the delivery-contract check — docker compose up, wait for health, run Playwright smoke, tear down
---

# /smoke

The single most important check in this project. ~50% of past hackathon submissions failed because this was not run. Not optional.

## Steps

1. Clean state:
   ```sh
   docker compose down -v --remove-orphans
   ```
2. Build + start:
   ```sh
   docker compose up --build -d
   ```
3. Wait for health:
   ```sh
   pnpm smoke:wait
   ```
   Aborts after 60 s if `/health` is not 200.
4. Run e2e smoke:
   ```sh
   pnpm test:e2e
   ```
5. Tear down (always, even on failure):
   ```sh
   docker compose down
   ```

Or run the whole thing via:

```sh
pnpm smoke
```

## Success criteria

- `docker compose up --build` returns to shell with no errors.
- `http://localhost:3000/health` returns `{status: "ok", db: true}`.
- `http://localhost:8080` loads and shows the `agora` wordmark.
- Playwright smoke is green (health, wordmark visible, ws echo round-trip).

## On failure

- Capture `docker compose logs api` and `docker compose logs web` in the journal entry for this session.
- Do not push. Fix first. Rerun from step 1.
