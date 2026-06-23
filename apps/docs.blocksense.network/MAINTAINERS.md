# Blocksense Documentation Website - Maintainer Guide

## Automated Deployment (CI/CD)

The documentation website is automatically deployed to **Cloudflare Pages** via GitHub Actions CI pipeline.

### Deployment Triggers

- **Pull Requests** targeting the `main` branch
- **Merge Queue** operations
- **Manual workflow dispatch** (via GitHub Actions UI)

### Process Overview

1. CI builds the site using: `yarn workspace @blocksense/docs.blocksense.network build:with-deps`
2. Static files are generated in `apps/docs.blocksense.network/dist`
3. Cloudflare Pages deploys to project: `blocksense-docs`
4. Deployment URL is posted as a PR comment for preview

## Manual Deployment (Emergency)

If you need to deploy manually outside of the CI process:

### Prerequisites

- Access to Cloudflare account with appropriate permissions
- **Install Wrangler CLI locally** (not available in Nix dev shell):
  ```bash
  # Install locally in the project (recommended for emergency use)
  yarn add -D wrangler
  # or: npm install --save-dev wrangler
  ```
- Authentication: `yarn wrangler auth login`

### Manual Deploy Steps

1. **Build the documentation site**:

   ```bash
   # From repository root (inside Nix dev shell)
   yarn install
   yarn workspace @blocksense/docs.blocksense.network build:with-deps
   ```

2. **Deploy to Cloudflare Pages**:

   ```bash
   # Using locally installed Wrangler
   yarn wrangler pages deploy apps/docs.blocksense.network/dist --project-name=blocksense-docs
   ```

3. **Verify deployment**:

   - Check the output URL from the deploy command
   - Ensure the site loads correctly

4. **Clean up** (optional):
   ```bash
   # Remove Wrangler after emergency deployment
   yarn remove wrangler
   ```

> **Note**: Wrangler is not included in the project's Nix development shell. For emergencies, install it locally as a dev dependency, which keeps it isolated to the project and doesn't require global package management.

## Setting Up New Deployment

### 1. Cloudflare Account Setup

1. **Create Cloudflare Account**:

   - Sign up at [cloudflare.com](https://cloudflare.com)
   - Verify email address

2. **Create Cloudflare Pages Project**:
   - Go to Cloudflare Dashboard → Pages
   - Create a new project named `blocksense-docs`
   - Choose "Upload assets" method (for manual deploys via CI)

### 2. Generate API Credentials

1. **Create API Token**:

   - Go to Cloudflare Dashboard → My Profile → API Tokens
   - Click "Create Token"
   - Use "Custom token" template with these permissions:
     - **Zone**: `Zone:Read` (for all zones)
     - **Account**: `Cloudflare Pages:Edit` (for specific account)
   - Copy the generated token

2. **Get Account ID**:
   - Go to Cloudflare Dashboard → Right sidebar
   - Copy the "Account ID" value

### 3. Configure GitHub Repository Secrets

Add these secrets in GitHub repository settings (`Settings → Secrets and variables → Actions`):

| Secret Name             | Description                   | How to Get          |
| ----------------------- | ----------------------------- | ------------------- |
| `CLOUDFLARE_API_TOKEN`  | API token for deployments     | From step 2.1 above |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account identifier | From step 2.2 above |

### 4. Test the Setup

1. Create a test PR with a documentation change
2. Verify the CI workflow runs successfully
3. Check that the deployment URL is posted in PR comments
4. Ensure the preview site loads correctly

## Troubleshooting

### Common Issues

1. **Build Failures**:

   - Check dependencies are up to date: `yarn install`
   - Verify TypeScript compilation: `yarn workspace @blocksense/docs.blocksense.network build:tsc`

2. **Deployment Failures**:

   - Verify Cloudflare credentials are valid
   - Check project name matches: `blocksense-docs`
   - Ensure account has sufficient permissions

3. **Missing Content**:
   - Run artifact collection: `yarn workspace @blocksense/docs.blocksense.network collect-artifacts`
   - Check contract documentation generation

### Support

For deployment issues:

- Check GitHub Actions logs for detailed error messages
- Verify Cloudflare Pages dashboard for deployment status
- Ensure all required secrets are properly configured

For questions about content updates, see the main [README.md](./README.md) file.
