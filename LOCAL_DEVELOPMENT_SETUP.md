# Local Development Setup Guide

This guide will help new developers set up the Renaissance API project for local development, including backend, database, smart contracts, and tests. Follow each section step-by-step.

---

## 1. Prerequisites

- **Node.js** (v18+ recommended)
- **pnpm** (preferred) or npm
- **PostgreSQL** (v14+ recommended)
- **Rust** (for smart contracts)
- **Make** (for contract scripts)
- **Git**

---

## 2. Backend Setup

1. **Clone the repository:**
   ```sh
   git clone <repo-url>
   cd Renaissance-api
   ```
2. **Install dependencies:**
   ```sh
   cd backend
   pnpm install
   # or
   npm install
   ```
3. **Configure environment variables:**
   - Copy `.env.example` to `.env` (if exists) and fill in required values.
   - If `.env.example` is missing, check `README.md` or ask a team member for required variables.

---

## 3. Database Setup

1. **Install PostgreSQL** and ensure it is running.
2. **Create the database:**
   - Update your `.env` with the correct DB credentials.
   - Run the setup script:
     ```sh
     psql -U <user> -f scripts/setup-database.sql
     ```
3. **Run migrations:**
   - Use the migration tool specified in `backend/README.md` (e.g., TypeORM, Prisma, or custom script).
   - Example:
     ```sh
     pnpm run migration:run
     # or
     npm run migration:run
     ```

---

## 4. Contract Compilation

1. **Install Rust toolchain:**
   ```sh
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
2. **Compile contracts:**
   ```sh
   cd contract
   cargo build --release
   ```

---

## 5. Contract Deployment (Local Testnet)

1. **Start a local blockchain node** (e.g., using [Anvil](https://book.getfoundry.sh/anvil/) or [Ganache](https://trufflesuite.com/ganache/)):
   ```sh
   anvil
   # or
   ganache-cli
   ```
2. **Deploy contracts locally:**
   ```sh
   cd contract/deployment
   # For Windows
   ./deploy-contracts.ps1
   # For Unix/macOS
   ./deploy-contracts.sh
   ```
   - Update deployment config as needed in `deployment-config.json`.

---

## 6. Running the Backend

1. **Start the backend server:**
   ```sh
   cd backend
   pnpm start:dev
   # or
   npm run start:dev
   ```

---

## 7. Running Tests

1. **Backend tests:**
   ```sh
   cd backend
   pnpm test
   # or
   npm test
   ```
2. **Contract tests:**
   ```sh
   cd contract
   cargo test
   ```

---

## 8. Troubleshooting

- **Missing Environment Variables:**
  - Double-check `.env` and `.env.example`.
  - Ask a team member for any secrets or values not in the repo.
- **Database Connection Errors:**
  - Ensure PostgreSQL is running and credentials are correct.
  - Check firewall or port issues.
- **Contract Compilation Issues:**
  - Ensure Rust is installed and up to date.
  - Run `rustup update` if needed.
- **Script Permission Errors:**
  - On Unix/macOS, run `chmod +x deploy-contracts.sh`.
- **Port Conflicts:**
  - Make sure required ports (e.g., 5432 for Postgres, 3000 for backend) are free.
- **Other Issues:**
  - Check project `README.md` files for more details.
  - Search open issues or ask in the team chat.

---

## 9. Additional Resources

- [backend/README.md](backend/README.md)
- [contract/README.md](contract/README.md)
- [DATABASE_README.md](backend/DATABASE_README.md)

---

If you encounter any issues not covered here, please reach out to the team for support.
