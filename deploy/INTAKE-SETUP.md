# Lead delivery
The site deliberately has no public property catalogue. Keep properties.json empty; the old catalogue admin is not a private CRM. Retired images remain in Git history, not the release tree.
- Netlify: existing function /api/submit; configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in the host environment.
- Shared Apache/PHP hosting: /api/submit is routed to api/submit/index.php; PHP cURL and the same environment variables are required. Configure privately through the hosting control panel, not in the repository.
- Production uses HTTPS; preview hostnames never send actual leads. Check a controlled, authorized test lead after deployment and confirm receipt by the office before declaring intake operational.
- Never store tokens or customer details in the public repo.
- Owner photos and documents are collected after coordination; the previous form's photo preview did not actually upload images.
