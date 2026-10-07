# Free-tier container hosting for `docker.io/emmanuel7044/docdoc:1.1`

Researched 2026-10-06. Workload: single Node.js 22 + Express container, port 3000, ~0 traffic, external S3 state, scale-to-zero OK.

## Summary table

| Provider | Permanent free? | Free grant | Docker Hub image directly? | Scale-to-zero | Card required? |
|---|---|---|---|---|---|
| **Google Cloud Run** | **Yes, permanent** | Request-based services: **180k vCPU-s + 360k GiB-s + 2M requests/month** (instance-based: 240k/450k). Aggregate per billing account, resets monthly | **Yes** — Docker Hub + GHCR public images deployable directly, cached up to 1 h | Yes (`min-instances=0` default) | **Yes** (billing account w/ card) |
| **Azure Container Apps** | **Yes, permanent** | Per subscription/month: **180k vCPU-s + 360k GiB-s + 2M HTTP requests** | Yes | Yes | Yes |
| **AWS Lambda + Function URL** | Free tier exists, but **new-account model changed 2025** (see notes) | 1M requests + 400k GB-s/month | **No** — must push to ECR | N/A (no idle cost) | Yes |
| **Oracle OCI Always Free** | **Yes, permanent** | **2 OCPU / 12 GB** Ampere A1 (1,500 OCPU-h + 9,000 GB-h/mo) **+ 2× AMD micro (1/8 OCPU, 1 GB)** | Yes (just run Docker on the VM) | No (always-on VM) | **Yes** (credit/debit, identity check) |
| **IBM Cloud Code Engine** | Claimed free tier | Exact amounts **unverified** | Yes | Yes | Yes |
| **Northflank** | Developer tier, **always-on compute** for 2 free services | 2 services + 2 cron jobs + 1 addon | Yes | No (always-on) | Card on file, not charged |
| **Koyeb** | **No free tier now** (Pro $29/mo + compute) | — | Yes | Yes | Yes |
| **Hetzner** | No — cheap, not free | CX22-class from ~€4/mo | Yes (Docker one-click) | No | Yes |

## Key notes

1. **Cloud Run (recommended).** Deploy with
   `gcloud run deploy docdoc --image docker.io/emmanuel7044/docdoc:1.1 --region europe-west1 --port 3000 --allow-unauthenticated`.
   Free tier is "based on us-central1 pricing" and applied as a spending-based discount, so it works in `us-central1` **and** `europe-west1` (both Tier 1). It covers **services and jobs separately** (jobs have their own 240k/450k grant; worker pools 384,204/728,744; delayed jobs 342,857/642,857). With `min-instances=0` **and request-based billing (the default)**, CPU/RAM are billed only during startup, graceful shutdown, and request processing — a scaled-to-zero service costs **$0**. Note: at ~0 traffic you are nowhere near 180k vCPU-s (that is ~50 h of continuous 1-vCPU work). Card/billing account is mandatory; Artifact Registry storage and Cloud Build are **not** free-tier-billed under Cloud Run pricing, but deploying a prebuilt Docker Hub image avoids both. Caveat: Cloud Run charges nothing for image pull, but flags Docker Hub for non-popular images (availability, not cost) — an Artifact Registry remote repository is the recommended mitigation.

2. **Azure Container Apps.** Free grants are **per subscription per calendar month** and apply to the **Consumption plan**. Replicas scaled to zero incur no resource charge. Idle charges only apply if `min-replicas > 0`. Only ingress from outside the environment is billable; health probes are free. Realistically equivalent to Cloud Run for this workload.

3. **AWS — the important caveat.** The Lambda pricing page still states "the free tier includes one million requests and 400,000 GB-seconds per month", and AWS lists 30+services as "Always free" on both Free and Paid plans. **But** for accounts created after 15 July 2025 the Free Tier became credit-based: $100 on signup + up to $100 more earned, valid 6 months, and the account auto-closes after 6 months or when credits run out. Whether the 1M/400k Lambda allowance survives as a true permanent allowance on the new Free plan is **unverified** — treat as **12-month/trial-ish, not permanent**. Build constraints: Lambda container images **must live in Amazon ECR** (you cannot point Lambda at Docker Hub), must implement the Lambda Runtime Interface Client, and the handler signature replaces an Express `listen(3000)` server — so this app needs real rework, not just a redeploy. Function URL is free of API Gateway charges (`AuthType: NONE` for public); hidden costs are ECR storage (free-tier amount unverified), CloudWatch Logs ingestion/storage, and data transfer.

4. **Oracle OCI Always Free.** Currently **2 OCPU + 12 GB** Ampere A1 total (docs updated 2026-06-12) — **halved from the historical 4 OCPU / 24 GB**, confirmed by InfoQ (July 2026) as an unannounced reduction. Plus up to **2× `VM.Standard.E2.1.Micro`** (AMD, 1/8 OCPU, 1 GB RAM, 50 Mbps), 200 GB block volume, 10 TB/mo egress. Still offered to new accounts; **credit or debit card required** (identity verification, no charge; prepaid/virtual cards rejected). **Reclamation:** accounts idle ≥30 days "may be deemed abandoned"; more concretely, Always Free compute instances can be reclaimed if, over a 7-day period, 95th-percentile CPU <20%, network <20%, and memory <20%. **ARM caveat:** the image is **amd64-only**, so on A1 you must run it emulated (`qemu`/`binfmt`, slow, extra RAM) or publish a multi-arch/arm64 build — an AMD micro VM avoids this but only has 1 GB RAM and 1/8 OCPU. Also note free-tier ARM capacity is frequently "out of host capacity".

5. **Others.** IBM Cloud Code Engine docs confirm a free tier exists and that scale-to-zero is free, but the **exact monthly vCPU-s/GB-s allowance is unverified**. Koyeb's current pricing shows **no free tier**. Northflank's Developer tier offers 2 services with **always-on compute (no sleeping)** — genuinely free-ish and appealing for a no-cold-start single container, but the free tier's existence/terms rest on marketing pages. Alibaba Function Compute free quotas not verified. Hetzner is paid-only but very cheap.

## Sources

- Cloud Run pricing: https://cloud.google.com/run/pricing
- Cloud Run deploying (registries): https://docs.cloud.google.com/run/docs/deploying
- Google Cloud Free Program / trial: https://docs.cloud.google.com/free/docs/free-cloud-features
- Azure Container Apps billing: https://learn.microsoft.com/en-us/azure/container-apps/billing
- AWS Lambda pricing (free tier): https://aws.amazon.com/lambda/pricing/
- AWS Free Tier overview ($200 credits / 6 months): https://aws.amazon.com/free/
- AWS free containers page: https://aws.amazon.com/free/containers/
- Lambda function URLs: https://docs.aws.amazon.com/lambda/latest/dg/urls-configuration.md
- Oracle Always Free resources: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- Oracle Free Tier FAQ (card, abandonment): https://www.oracle.com/cloud/free/
- Oracle A1 halving (InfoQ, Jul 2026): https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/
- IBM Code Engine pricing: https://cloud.ibm.com/docs/codeengine?topic=codeengine-pricing
- Koyeb pricing: https://www.koyeb.com/pricing
- Northflank pricing: https://www.northflank.com/pricing
- Hetzner Cloud: https://www.hetzner.com/cloud/
