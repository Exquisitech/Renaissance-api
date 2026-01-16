# Renaissance-api

Renaissance is a Web3-powered football fan engagement platform built on the **Stellar blockchain**, designed to redefine how fans follow teams, engage with football stars, and participate in transparent sports betting.

This repository contains the **backend services** that power user management, live football data ingestion, betting orchestration, premium content access, and integration with **Stellar Soroban smart contracts**.

---

## 🚀 Project Overview

The Renaissance backend acts as the **core orchestration layer** between:
- A high-performance **Web2 infrastructure** (for live scores, content, and scalability)
- A **Web3 blockchain layer on Stellar** (for trustless betting, ownership, and rewards)

The backend is optimized for **real-time football events**, high concurrency during live matches, and seamless interaction with Soroban smart contracts deployed on Stellar.

---

## 🎯 Core Responsibilities

- Fetch and cache **live football data** (fixtures, scores, teams, players)
- Orchestrate **on-chain betting workflows**
- Manage **user profiles and preferences**
- Handle **fan engagement logic** (following teams, stats, rewards)
- Gate **premium footballer lifestyle content**
- Interface with **Stellar Soroban smart contracts**
- Expose secure APIs for the Next.js frontend
- Ensure reliability during traffic spikes

---

## 🏗️ Tech Stack

### Backend Framework
- **Node.js**
- **NestJS** – modular, scalable backend architecture
- **TypeScript** – strong typing and maintainability

### Database & Caching
- **PostgreSQL** – primary relational database
- **Prisma ORM** – type-safe database access
- **Redis** – caching live scores, odds, and hot queries

### Blockchain & Web3
- **Stellar Blockchain**
- **Soroban Smart Contracts** – on-chain betting & rewards logic
- **Stellar SDK** – blockchain interaction
- **Freighter Wallet** (and other Stellar-compatible wallets)

### External Services
- Football data APIs (e.g. API-Football, SportMonks)
- CMS (Sanity / Strapi) for premium lifestyle content
- IPFS / Arweave (optional) for decentralized media storage

### DevOps & Tooling
- Docker
- GitHub Actions (CI/CD)
- Swagger / OpenAPI for API documentation
- Sentry for error monitoring

---

## 📁 Project Structure

```bash
src/
├── auth/               # Authentication & wallet linking
├── users/              # User profiles & preferences
├── teams/              # Teams & players data
├── matches/            # Fixtures & live scores
├── betting/            # Betting orchestration logic
├── content/            # Premium & lifestyle content access
├── blockchain/         # Stellar & Soroban interactions
├── common/             # Shared utilities, guards, interceptors
├── config/             # Environment & app configuration
├── main.ts             # Application entry point
└── app.module.ts       # Root module
