# sops Rotation Procedure

> **Note (2026-09-07):** the AWS KMS path documented in earlier revisions
> of this runbook is no longer the active mechanism. tastile-web now uses
> **one age key per env** (development / staging / production) for
> per-environment isolation, with the private half of each key stored as
> a distinct GitHub Secret (`SOPS_AGE_KEY_DEVELOPMENT`,
> `SOPS_AGE_KEY_STAGING`, `SOPS_AGE_KEY_PRODUCTION`).

## Active mechanism: age (per env)

1. **One-time key bootstrap per env (operator only)**

   Generate three keypairs (one per env) and keep the private halves
   off-disk between use:

   ```bash
   mkdir -p keys/age
   for env in development staging production; do
     age-keygen -o "keys/age/tastile-web.${env}.key"
     chmod 0600 "keys/age/tastile-web.${env}.key"
   done
   ```

   Capture the printed public keys (`age1...`) and paste them into
   `.sops.yaml` (one `age:` value per `path_regex`) and
   `scripts/sops.config.ts` (`ageRecipient` per env). Register the
   **contents** of `keys/age/tastile-web.<env>.key` (NOT the path) as the
   matching GitHub Secret in
   `tastile/tastile-web → Settings → Secrets and variables → Actions`:
   `SOPS_AGE_KEY_DEVELOPMENT`, `SOPS_AGE_KEY_STAGING`,
   `SOPS_AGE_KEY_PRODUCTION`. Do **not** echo private keys into chat,
   issues, PR bodies, or commit messages.

   Store an offline backup of every private key (1Password, sealed
   envelope, etc.). The private keys are the only way to recover the
   plaintext .env files if the GitHub Secret is lost.

2. **Update plain text locally**

   Each env's key unlocks only that env's ciphertext. Stage the key you
   need into the standard sops location:

   ```bash
   export SOPS_AGE_KEY_FILE="${HOME}/.config/sops/age/keys.txt"
   mkdir -p "$(dirname "${SOPS_AGE_KEY_FILE}")"
   # Bundle whichever envs you intend to decrypt locally; never commit
   # the bundle to the repo.
   cat keys/age/tastile-web.development.key \
       keys/age/tastile-web.staging.key \
       keys/age/tastile-web.production.key \
       > "${SOPS_AGE_KEY_FILE}"
   chmod 0600 "${SOPS_AGE_KEY_FILE}"
   ```

   ```bash
   sops --decrypt .env.development.sops > .env.development
   ```

3. **Edit the plain file** to reflect the new secret(s).

4. **Re-encrypt in place**

   ```bash
   sops --input-type env --output-type env \
     --encrypt --filename-override .env.development.sops \
     .env.development > .env.development.sops
   ```

5. **Verify diff**

   ```bash
   git diff .env.development.sops
   ```

   Reviewer confirms the `ENC[...]` block changed and not unrelated keys.

6. **Open PR**. The `sops-decrypt --check` job verifies decryptability
   without emitting plaintext. After merge, the next CI run on `develop`
   regenerates the artifact.

7. **Cross-repo secret drift check**

   If the rotated value is `TASTILE_WEB_BRIDGE_SECRET` or another
   cross-repo secret, repeat steps 2-6 in every consumer repo on the
   same day. Use `gh search code "TASTILE_WEB_BRIDGE_SECRET"` to
   enumerate consumers.

8. **Production deploy**: the release workflow consumes the artifact
   and ships the new plain file via the existing systemd
   EnvironmentFile deploy path. Confirm via
   `sudo systemctl show tastile-web -p EnvironmentFiles`.

## Rollback

`sops` decrypt with stale ciphertext → fails to decrypt.
Re-encrypt from a known-good backup of the old plain file; the diff
will revert to the previous ciphertext. Force a new release.

## Key rotation (age)

To rotate one env: generate a fresh keypair, replace the matching
`age:` value in `.sops.yaml` and `ageRecipient` in
`scripts/sops.config.ts`, run `sops updatekeys -y` against that env's
`*.sops` file, and overwrite the corresponding GitHub Secret. Old
private keys should be destroyed only after the new ciphertext has been
verified decryptable on CI.

## Risk acceptance: single-secret callers

If a Tastile tool or pipeline outside this repository forwards
`secrets.SOPS_AGE_KEY_*` as a single `sops_age_key` input to the
reusable workflow, it must forward every per-env secret. The reusable
workflow selects by `inputs.env` and exits 3 if the matching secret is
empty — that is the safety net that prevents an unrelated env from
silently falling through to plaintext. Reviewers: refuse any change
that collapses the three secrets into one.
