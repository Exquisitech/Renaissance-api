# Database Migration Strategy

## Overview

This document describes how database migrations are handled in this project, including:

- How to generate migrations
- Naming conventions
- How to run and rollback migrations
- Production deployment strategy
- Safe migration practices

This ensures consistent schema evolution, safe deployments, and reliable rollback procedures.

---

# 1. What Are Migrations?

Database migrations are version-controlled changes to the database schema. They allow us to:

- Evolve the schema safely
- Track structural changes in Git
- Synchronize development, staging, and production environments
- Roll back changes if needed

---

# 2. Migration Tooling

This project uses:

- TypeORM CLI
- PostgreSQL
- TypeScript-based migration files

Migrations are stored in:

```
/src/database/migrations
```

---

# 3. Generating Migrations

## Step 1: Make Schema Changes

Update your:

- Entity files
- Relations
- Indexes
- Constraints

Do NOT modify the database manually.

---

## Step 2: Generate Migration Automatically

```
npm run typeorm migration:generate -- src/database/migrations/<MigrationName>
```

Example:

```
npm run typeorm migration:generate -- src/database/migrations/AddUserReputation
```

This command:

- Compares current entities with the database
- Generates SQL changes automatically

---

## Alternative: Create Empty Migration (Manual)

If you need custom SQL:

```
npm run typeorm migration:create -- src/database/migrations/<MigrationName>
```

Example:

```
npm run typeorm migration:create -- src/database/migrations/AddIndexesToUsers
```

---

# 4. Naming Conventions

All migration names must follow this structure:

```
<FeatureOrPurpose><Action>
```

### Good Examples

- AddUserReputation
- CreateTransactionsTable
- AddIndexToEmailColumn
- UpdatePortfolioRelations

### Bad Examples

- migration1
- update
- fix
- changes

### Rules

- Use PascalCase
- Be descriptive
- Reflect schema intent
- One logical change per migration

---

# 5. Running Migrations

## Run All Pending Migrations

```
npm run typeorm migration:run
```

Applies all new migrations in order.

---

## Show Migration Status

```
npm run typeorm migration:show
```

Displays:

- Executed migrations
- Pending migrations

---

# 6. Rolling Back Migrations

## Roll Back Last Migration

```
npm run typeorm migration:revert
```

Each revert:

- Undoes the last executed migration
- Runs the `down()` method

---

## Roll Back Multiple Migrations

Run the revert command repeatedly until the desired state is reached.

---

# 7. Migration File Structure

Example migration:

```ts
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserReputation1690000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN reputation INTEGER DEFAULT 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN reputation;
    `);
  }
}
```

---

# 8. Production Migration Strategy

## Important Principles

- Never use `synchronize: true` in production
- Always review generated migrations
- Never modify executed migration files
- Always test migrations in staging first

---

## Production Deployment Process

### Step 1: Merge Migration to Main

- Migration must be reviewed in PR
- CI must pass
- Migration tested locally and staging

---

### Step 2: Deploy Application

Deployment pipeline should:

1. Build application
2. Install dependencies
3. Run migrations
4. Start server

Example:

```
npm run build
npm run typeorm migration:run
npm run start:prod
```

---

# 9. Safe Deployment Strategy

## Backward Compatible Migrations

Always prefer the expand → migrate → contract pattern.

### Example Safe Pattern

1. Add new column (nullable)
2. Deploy app using both old and new column
3. Backfill data
4. Remove old column in later migration

---

## Dangerous Migrations

Avoid:

- Dropping columns immediately
- Renaming columns without transition
- Changing column types without backup
- Deleting data without backup

---

# 10. Zero-Downtime Strategy

For high-availability environments:

1. Add new structure
2. Deploy code that supports both versions
3. Migrate data safely
4. Remove old structure later

---

# 11. Data Safety Guidelines

Before major migrations:

- Take full database backup
- Validate row counts
- Test rollback scenario
- Monitor logs during deployment

---

# 12. Testing Migrations

Before merging:

- Run on fresh database
- Run on existing populated database
- Test `migration:revert`
- Confirm schema integrity

---

# 13. CI/CD Integration (Recommended)

Example GitHub Actions step:

```yaml
- name: Run migrations
  run: npm run typeorm migration:run
```

Ensure:

- Database credentials are set
- Environment variables are loaded
- Migration failures stop deployment

---

# 14. Migration Checklist (PR Review)

Before approving a migration PR:

- [ ] Migration file generated
- [ ] Naming follows convention
- [ ] `down()` properly implemented
- [ ] No destructive unsafe operations
- [ ] Tested locally
- [ ] Tested rollback
- [ ] CI passes

---

# 15. Version Control Policy

- Migration files must be committed
- One migration per logical schema change
- Never squash migrations after production release

---

# Summary

This migration strategy ensures:

- Predictable schema evolution
- Safe deployments
- Rollback capability
- Production reliability
- Zero-downtime best practices

Following this document strictly protects database integrity and prevents production outages.
