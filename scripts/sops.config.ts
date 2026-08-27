// Per-repo sops config for tastile-web.
//
// The canonical SopsEnvConfig type lives at tastile-root/scripts/sops.config.ts
// (committed at 019d248) and lacks the `identityHint` field introduced by Task 3.
// Since SopsEnvConfig is a `type` alias (not an `interface`), TypeScript module
// augmentation cannot extend it. Per-repo config files therefore re-define the
// full type with `identityHint` appended. The loader's `loadConfig` /
// `decryptOne` ignore fields they do not use, so the augmented shape is
// forward-compatible with the canonical loader.
//
// Replace <account> placeholders with Terraform outputs from Task 1
// (terraform apply in tastile-root/infra/).

export type SopsEnvConfig = {
  kmsKeyArn: string;
  awsRegion: string;
  sourceFiles: string[];
  targetFiles: string[];
  check: boolean;
  identityHint: "sso" | "oidc" | "instance-profile";
};

export const config: Record<string, SopsEnvConfig> = {
  development: {
    awsRegion: "ap-northeast-1",
    kmsKeyArn: "arn:aws:kms:ap-northeast-1:<account>:key/<dev-key-id>",
    sourceFiles: [".env.development.sops", ".env.dev.sops"],
    targetFiles: [".env.development", ".env.dev"],
    check: false,
    identityHint: "sso",
  },
  staging: {
    awsRegion: "ap-northeast-1",
    kmsKeyArn: "arn:aws:kms:ap-northeast-1:<account>:key/<staging-key-id>",
    sourceFiles: [".env.staging.sops"],
    targetFiles: [".env.staging"],
    check: false,
    identityHint: "oidc",
  },
  production: {
    awsRegion: "ap-northeast-1",
    kmsKeyArn: "arn:aws:kms:ap-northeast-1:<account>:key/<production-key-id>",
    sourceFiles: [".env.production.sops", ".env.product.sops"],
    targetFiles: [".env.production", ".env.product"],
    check: false,
    identityHint: "instance-profile",
  },
};