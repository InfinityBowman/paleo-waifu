# Terraform — Cloudflare WAF Rate Limiting

Manages Cloudflare WAF rate limiting rules for the `domain` zone via Infrastructure as Code.

## Prerequisites

1. **Terraform** installed (`brew install terraform`)
2. **Cloudflare API token** with `Zone > WAF > Edit` permission scoped to `domain`
   - Create at: https://dash.cloudflare.com/profile/api-tokens
3. **Zone ID** — found in Cloudflare dashboard > domain > Overview (right sidebar)

## Setup

```bash
cd terraform

# Copy and fill in your credentials
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your API token and zone ID

# Initialize (downloads Cloudflare provider)
terraform init
```

## Usage

```bash
# Preview what will change
terraform plan

# Apply changes to Cloudflare
terraform apply

# Destroy all managed resources (removes rate limiting rules)
terraform destroy
```

## What's Managed

| Resource | Description |
|----------|-------------|
| `cloudflare_ruleset.rate_limiting` | Rate limiting rule for all `/api/*` endpoints |

### Current Rule

| Expression | Limit | Period | Block Duration |
|-----------|-------|--------|----------------|
| `starts_with(http.request.uri.path, "/api/")` | 10 requests | 10 seconds | 10 seconds |

Rate limiting is per-IP per-colo (Cloudflare data center). If a single IP exceeds 5 API requests in 10 seconds, they're blocked for 10 seconds.

## Modifying Rules

Edit `main.tf` and run `terraform apply`. Common changes:

- **Adjust threshold**: Change `requests_per_period`
- **Change expression**: Use [Cloudflare filter expressions](https://developers.cloudflare.com/ruleset-engine/rules-language/expressions/)
- **Disable temporarily**: Set `enabled = false`

## Files

| File | Purpose | Git tracked? |
|------|---------|-------------|
| `main.tf` | Provider config + rate limiting ruleset | Yes |
| `variables.tf` | Variable declarations | Yes |
| `terraform.tfvars` | Your credentials (secrets) | **No** (gitignored) |
| `terraform.tfvars.example` | Template for credentials | Yes |
| `.terraform.lock.hcl` | Provider version lock | Yes |
| `.terraform/` | Provider binaries (auto-downloaded) | No |
| `terraform.tfstate` | State file (tracks what's deployed) | **No** (gitignored) |

## Important Notes

- **State file** (`terraform.tfstate`) tracks what Terraform has deployed. Don't delete it or Terraform will lose track of existing resources.
- **Don't mix** dashboard edits with Terraform — if you edit rate limiting rules in the Cloudflare dashboard, Terraform will detect drift and try to revert your changes on next `terraform apply`.
- The Free plan limits you to 1 rate limiting rule with 10s period/timeout. Upgrading to Pro unlocks 5 rules with configurable periods (10s, 60s, 120s, 300s).
