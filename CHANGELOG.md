# Changelog

All notable changes to CamerMove will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v.0.1-beta] - 2026-09-14

### Added
- Initial release of CamerMove platform
- Multi-service booking system (Transport, Hotels, Rentals, Parcels, Insurance, Events)
- JWT-based authentication with role-based access control (RBAC)
- Real-time seat availability tracking with WebSocket updates
- Mobile Money payment integration (Orange Money, MTN MoMo)
- Responsive landing page with service rails
- Admin dashboard for managing bookings, trips, and users
- Transporter portal for trip management
- FAQ and legal pages (CGU, Privacy Policy)
- Sitemap and robots.txt for SEO
- Comprehensive API documentation with OpenAPI/Swagger

### Features
- **Transport Interurbain**: Search, compare, and book bus tickets
- **Hotels**: Browse and book verified accommodations
- **Rentals**: Rent vehicles with airport pickup
- **Parcels**: Send packages with real-time tracking
- **Insurance**: Travel insurance coverage from 2,500 XAF
- **Events**: Event ticketing with mobile tickets

### Technical
- Monorepo architecture with pnpm workspaces
- Next.js 16 frontend with Turbopack
- Fastify API with Prisma ORM
- PostgreSQL database with Redis caching
- Kafka for event-driven architecture
- BullMQ for background job processing
- Docker Compose for local development

### Documentation
- MIT License
- Contribution guidelines
- French HTML documentation
- API documentation at `/docs`

## [Unreleased]

### Planned
- Google OAuth integration
- Email notifications
- Advanced analytics dashboard
- Mobile application (React Native)
- Multi-language support (English, French)
- Partner API for third-party integrations
