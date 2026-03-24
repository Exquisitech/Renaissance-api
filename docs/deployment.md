Production Deployment Guide

This document explains how to deploy the Renaissance API backend to production, including environment configuration, database migrations, smart contract setup, and security practices.

The platform integrates a Web2 backend with the Stellar Development Foundation ecosystem for blockchain-based betting and rewards.

1. Environment Configuration

Production configuration must be stored using environment variables.

Create a .env file (never commit this file):

NODE_ENV=production
PORT=4000

DATABASE_URL=postgresql://username:password@host:5432/renaissance

REDIS_URL=redis://localhost:6379

JWT_SECRET=your_secure_secret

STELLAR_RPC_URL=https://rpc.mainnet.stellar.org
STELLAR_NETWORK=PUBLIC
SOROBAN_CONTRACT_ADDRESS=your_contract_address
ADMIN_SECRET_KEY=your_private_key
Security Rules

Never commit .env

Use .env.example for documentation only

Store production secrets in:

GitHub Actions Secrets

Docker secrets

Cloud secret managers (AWS/GCP/Vercel)

2. Install Dependencies
npm install
3. Build the Application
npm run build

This generates the compiled production output.

4. Database Migration Strategy

Database migrations must always run before starting production.

Generate Migration (Development)
npx prisma migrate dev --name init
Run Migration (Production)
npx prisma migrate deploy
Important Safety Rules

Never enable auto-sync in production

Always backup database before migrations

Test migrations in staging first

5. Redis Setup (Caching Layer)

Ensure Redis is running:

docker run -d -p 6379:6379 redis

Redis is used for:

Live match caching

Odds caching

Session storage

6. Smart Contract Deployment (Soroban)

The backend interacts with deployed Soroban contracts.

Build Contract
cargo build --target wasm32-unknown-unknown --release
Deploy Contract
soroban contract deploy \
--wasm target/wasm32-unknown-unknown/release/contract.wasm \
--source admin

After deployment:

Save contract address

Add it to .env

SOROBAN_CONTRACT_ADDRESS=xxxxx
7. Backend Start Command

Production start:

npm run start:prod

Or with Docker:

docker build -t renaissance-api .
docker run -p 4000:4000 renaissance-api
8. CI/CD Deployment Flow (Recommended)

Example pipeline steps:

Install dependencies

Run tests

Build project

Run migrations

Deploy container

Restart service

9. Key Management Best Practices

Private keys are used for:

Oracle signing

Contract interactions

Admin operations

Rules

Never store keys in code

Use environment variables

Rotate keys regularly

Restrict admin access

Recommended:

Cloud secret managers

Hardware wallets for admin keys

10. Production Safety Checklist

Before deploying:

 No secrets committed

 .env.example exists

 Database backup created

 Migrations tested

 Contract address configured

 Redis running

 Logging enabled

 Error monitoring enabled

11. Monitoring & Logging

Recommended tools:

Sentry (error tracking)

Prometheus (metrics)

Grafana (dashboards)

Monitor:

API latency

WebSocket load

Blockchain transaction failures

12. Rollback Strategy

If deployment fails:

Roll back container image

Restore database backup (if needed)

Revert contract upgrade (if applicable)

Files Required for Production
.env
.env.example
docs/deployment.md
Dockerfile