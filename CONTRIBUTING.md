# Contribution Guide - CamerMove

Thank you for your interest in contributing to CamerMove! This document provides guidelines for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Respect different viewpoints and experiences

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL, Redis, Kafka)

### Setup

```bash
# Clone the repository
git clone https://github.com/menoc61/camermove.git
cd camermove

# Install dependencies
pnpm install

# Set up environment variables
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Start infrastructure
docker compose up -d

# Run migrations
pnpm db:migrate

# Seed database (optional)
pnpm db:seed

# Start development servers
pnpm dev
```

## Development Workflow

1. Create a feature branch from `master`
2. Make your changes
3. Write/update tests
4. Run type checks: `pnpm -r typecheck`
5. Run tests: `pnpm -r test`
6. Submit a pull request

## Coding Standards

### General Principles

- **Statelessness** — No server-side sessions; use JWT authentication
- **Idempotency** — All POST/PUT/PATCH endpoints accept Idempotency-Key
- **Validation** — Use Zod for all input validation
- **Security** — Never log sensitive data; use argon2 for passwords

### File Organization

- One module = one directory with `schema.ts`, `service.ts`, `repository.ts`, `routes.ts`, `types.ts`
- Keep files under 300 lines
- Use absolute imports with `@/` prefix for packages

### Naming Conventions

- Files: `kebab-case.ts`
- Components: `PascalCase.tsx`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Types/interfaces: `PascalCase`

### TypeScript

- Strict mode enabled
- No `any` types (use `unknown` with type guards)
- Export types from `types.ts` files

## Commit Guidelines

Format: `<type>(<scope>): <description>`

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

Examples:
```
feat(bookings): add seat hold expiration
fix(auth): correct JWT token refresh logic
docs(api): update booking endpoint documentation
```

## Pull Request Process

1. Update documentation if needed
2. Add tests for new features
3. Ensure all tests pass
4. Request review from maintainers
5. Address review feedback
6. Squash commits if requested

## Project Structure

```
camermove/
├── apps/
│   ├── api/          # Fastify REST API
│   ├── web/          # Next.js frontend
│   └── worker/       # Background job processor
├── packages/
│   ├── config/       # Shared configuration
│   ├── db/           # Prisma schema & repositories
│   ├── events/       # Kafka event definitions
│   ├── frontend#     # Shared frontend utilities
│   ├── media#        # Media processing
│   ├── observability # Logging & metrics
│   └── shared#       # Shared utilities
├── docs/             # Documentation
├── infra/            # Infrastructure configs
└── tests#            # E2E tests
```

## Questions?

Open an issue or contact the maintainers at contact@camermove.cm
