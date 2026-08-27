# sops AMI Preparation

Each EC2 instance profile running production must have:
1. `tastile-ec2-instance-profile` policy attached (Terraform, Task 1)
2. `sops` v3.9.0 installed at `/usr/local/bin/sops` (sha256 verified)
3. `bun` runtime at `/usr/bin/bun`
4. `.env.production.sops` + `.sops.yaml` + `scripts/sops-decrypt.ts` + `scripts/sops.config.ts` + `scripts/sops-decrypt.sh` deployed to `/opt/tastile-web/`

Provisioning steps (user_data or Ansible):
```bash
curl -fsSL -o /tmp/sops https://github.com/getsops/sops/releases/download/v3.9.0/sops-v3.9.0.linux.amd64
curl -fsSL -o /tmp/sops.sha256 https://github.com/getsops/sops/releases/download/v3.9.0/sops-v3.9.0.linux.amd64.sha256
(cd /tmp && sha256sum -c sops.sha256)
mv /tmp/sops /usr/local/bin/sops && chmod +x /usr/local/bin/sops
```

Verification: `sudo -u tastile AWS_PROFILE=default /opt/tastile-web/scripts/sops-decrypt.sh --env=production` produces `/opt/tastile-web/.env.production` with mode `0600`.
