// Per-repo sops config for tastile-web.
//
// Local fork of tastile-root/scripts/sops.config.ts. We pin one age
// recipient per env (development / staging / production) so a single
// leaked identity can only decrypt the env it serves. AWS KMS is out of
// scope for this iteration (operator directive, Daily Scrum 2026-09-07).
//
// The recipient values MUST match the matching `age:` line in `.sops.yaml`
// and the public half of the private key registered as
// SOPS_AGE_KEY_{DEVELOPMENT,STAGING,PRODUCTION} in repo settings. Rotation
// is documented in docs/runbooks/sops-rotation.md.
//
// `pairs` is intentionally trimmed to the two envs for which this PR
// commits ciphertext. .env.staging / .env.product / .env.dev are reserved
// for a follow-up that brings those envelopes; until then the loader
// gracefully skips missing source files (see processSourceFiles).

export type SopsEnvConfig = {
  ageRecipient: string;
  pairs: { source: string; target: string }[];
};

export const config: Record<string, SopsEnvConfig> = {
  development: {
    ageRecipient:
      "age1q0rp9dflllkxy62fd6dwqfeqt9pl6ekyz2dff3sjwsy8xqrlcplsww8q5z",
    pairs: [{ source: ".env.development.sops", target: ".env.development" }],
  },
  staging: {
    ageRecipient:
      "age1ly2htqxgr35vgzlhg2ln3u72r9hpd8knlzzuvnhvmycfqsq9myeq3u22fx",
    pairs: [],
  },
  production: {
    ageRecipient:
      "age1dm4t40x7v95thpr426ay8tggz5jfw0f42dkwxucqum3509yv4gwqwhzl5k",
    pairs: [{ source: ".env.production.sops", target: ".env.production" }],
  },
};
