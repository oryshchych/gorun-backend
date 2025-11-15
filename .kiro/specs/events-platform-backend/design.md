# Design Document

## Overview

The Events Platform Backend is a RESTful API built with Node.js, Express, TypeScript, and MongoDB. The architecture follows a layered approach with clear separation of concerns: routes handle HTTP requests, controllers orchestrate business logic, services implement domain logic, and models define data structures. The system uses JWT-based authentication with access and refresh tokens, implements MongoDB transactions for data consistency, and follows security best practices including rate limiting, input validation, and password hashing.

## Architecture

### High-Level Architecture

```
┌─────────────┐
│   Client    │
│  (Frontend) │
└──────┬──────┘
       │ HTTP/HTTPS
       ▼
┌─────────────────────────────────────────┐
│         Express Middleware Layer        │
│  ┌────────────────────────────────────┐ │
│  │ CORS │ Helmet │ Rate Limiter │ etc │ │
│  └────────────────────────────────────┘ │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│           Routes Layer                   │
│  ┌────────┬────────┬──────────────────┐ │
│  │  Auth  │ Events │  Registrations   │ │
│  └────────┴────────┴──────────────────┘ │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      Validation Middleware               │
│         (Zod Schemas)                    │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│        Controllers Layer                 │
│  ┌────────┬────────┬──────────────────┐ │
│  │  Auth  │ Events │  Registrations   │ │
│  └────────┴────────┴──────────────────┘ │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Services Layer                   │
│  ┌────────┬────────┬──────────────────┐ │
│  │  Auth  │ Events │  Registrations   │ │
│  └────────┴────────┴──────────────────┘ │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│          Models Layer                    │
│  ┌────┬───────┬──────────┬────────────┐ │
│  │User│ Event │Registration│RefreshToken││
│  └────┴───────┴──────────┴────────────┘ │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│          MongoDB Database                │
└─────────────────────────────────────────┘
```

### Layer Responsibilities

**Routes Layer**: Defines API endpoints, applies middleware (authentication, validation), and delegates to controllers

**Controllers Layer**: Handles HTTP request/response, extracts data from requests, calls services, formats responses

**Services Layer**: Implements business logic, orchestrates database operations, handles transactions

**Models Layer**: Defines data schemas, validation rules, indexes, and database interactions

**Middleware Layer**: Cross-cutting concerns (authentication, validation, error handling, rate limiting)

## Components and Interfaces

### Authentication System

#### JWT Utilities (`src/utils/jwt.util.ts`)

```typescript
interface JWTPayload {
  userId: string;
}

function generateAccessToken(userId: string): string
function generateRefreshToken(userId: string): string
function verifyAccessToken(token: string): JWTPayload
function verifyRefreshToken(token: string): JWTPayload
```

**Design Decision**: Separate access and refresh tokens with different expiration times (15m vs 7d) to balance security and user experience. Access tokens are short-lived to minimize exposure, while refresh tokens enable seamless session renewal.

#### Password Utilities (`src/utils/password.util.ts`)

```typescript
function hashPassword(password: string): Promise<string>
function comparePassword(password: string, hash: string): Promise<boolean>
```

**Design Decision**: Use bcrypt with 10 salt rounds as it provides strong security while maintaining acceptable performance. The async nature prevents blocking the event loop.

#### Auth Middleware (`src/middleware/auth.middleware.ts`)

```typescript
interface AuthRequest extends Request {
  user?: {
    userId: string;
  };
}

function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void>
```

**Design Decision**: Extend Express Request type to include user information, making it type-safe and accessible in controllers. Extract token from Authorization header using Bearer scheme.

#### Auth Service (`src/services/auth.service.ts`)

```typescript
interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface AuthResponse {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
}

class AuthService {
  async register(input: RegisterInput): Promise<AuthResponse>
  async login(input: LoginInput): Promise<AuthResponse>
  async refreshAccessToken(refreshToken: string): Promise<AuthResponse>
  async logout(refreshToken: string): Promise<void>
  async getCurrentUser(userId: string): Promise<UserResponse>
}
```

**Design Decision**: Service returns both tokens and user data in a single response to minimize round trips. Refresh token is stored in database for revocation capability.

### Event Management System

#### Event Service (`src/services/events.service.ts`)

```typescript
interface CreateEventInput {
  title: string;
  description: string;
  date: Date;
  location: string;
  capacity: number;
  imageUrl?: string;
}

interface UpdateEventInput {
  title?: string;
  description?: string;
  date?: Date;
  location?: string;
  capacity?: number;
  imageUrl?: string;
}

interface EventFilters {
  search?: string;
  startDate?: Date;
  endDate?: Date;
  location?: string;
}

interface PaginationParams {
  page: number;
  limit: number;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class EventsService {
  async getEvents(
    filters: EventFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<EventResponse>>
  
  async getEventById(id: string): Promise<EventResponse>
  
  async createEvent(
    userId: string,
    input: CreateEventInput
  ): Promise<EventResponse>
  
  async updateEvent(
    id: string,
    userId: string,
    input: UpdateEventInput
  ): Promise<EventResponse>
  
  async deleteEvent(id: string, userId: string): Promise<void>
  
  async getMyEvents(
    userId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<EventResponse>>
  
  async checkUserRegistration(
    eventId: string,
    userId: string
  ): Promise<{ isRegistered: boolean }>
}
```

**Design Decision**: Separate filters and pagination parameters for clarity. Use optional fields in UpdateEventInput to support partial updates. Include organizer check in service layer for authorization.

#### Authorization Middleware (`src/middleware/authorization.middleware.ts`)

```typescript
function isEventOrganizer(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void>
```

**Design Decision**: Create reusable authorization middleware that can be composed with authentication middleware. Loads event and checks ownership before proceeding.

### Registration System

#### Registration Service (`src/services/registrations.service.ts`)

```typescript
interface CreateRegistrationInput {
  eventId: string;
}

interface RegistrationFilters {
  eventId?: string;
  status?: 'confirmed' | 'cancelled';
}

class RegistrationsService {
  async createRegistration(
    userId: string,
    input: CreateRegistrationInput
  ): Promise<RegistrationResponse>
  
  async cancelRegistration(
    id: string,
    userId: string
  ): Promise<void>
  
  async getRegistrations(
    filters: RegistrationFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<RegistrationResponse>>
  
  async getMyRegistrations(
    userId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<RegistrationResponse>>
  
  async getEventRegistrations(
    eventId: string,
    userId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<RegistrationResponse>>
}
```

**Design Decision**: Use MongoDB transactions in createRegistration and cancelRegistration to ensure atomicity when updating both Registration and Event documents. This prevents race conditions and maintains data consistency.

### Validation System

#### Validation Middleware (`src/middleware/validation.middleware.ts`)

```typescript
enum ValidationType {
  BODY = 'body',
  QUERY = 'query',
  PARAMS = 'params'
}

function validate(
  schema: z.ZodSchema,
  type: ValidationType = ValidationType.BODY
): RequestHandler
```

**Design Decision**: Use Zod for runtime validation with TypeScript type inference. Support validation of body, query, and params. Return detailed field-level errors for better developer experience.

### Error Handling System

#### Custom Error Classes (`src/types/errors.ts`)

```typescript
class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  
  constructor(message: string, statusCode: number)
}

class ValidationError extends AppError {
  errors: Record<string, string[]>;
  
  constructor(errors: Record<string, string[]>)
}

class UnauthorizedError extends AppError
class ForbiddenError extends AppError
class NotFoundError extends AppError
class ConflictError extends AppError
```

**Design Decision**: Create custom error classes for different HTTP status codes. Include isOperational flag to distinguish between operational errors (expected) and programming errors (bugs).

#### Error Middleware (`src/middleware/error.middleware.ts`)

```typescript
function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void
```

**Design Decision**: Centralized error handling that formats all errors consistently, logs them appropriately, and hides sensitive information in production. Handles Mongoose errors, JWT errors, and custom errors.

## Data Models

### User Model

```typescript
interface IUser {
  _id: ObjectId;
  name: string;
  email: string;
  password: string;
  image?: string;
  provider: 'credentials' | 'google';
  providerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Schema configuration
{
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      delete ret.password;
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
    }
  }
}

// Indexes
email: { unique: true }
{ provider: 1, providerId: 1 }: { unique: true, sparse: true }

// Methods
comparePassword(password: string): Promise<boolean>

// Hooks
pre('save'): Hash password if modified
```

**Design Decision**: Support both credential-based and OAuth authentication through provider field. Use sparse index on provider+providerId to allow null values. Automatically exclude password from JSON responses for security.

### Event Model

```typescript
interface IEvent {
  _id: ObjectId;
  title: string;
  description: string;
  date: Date;
  location: string;
  capacity: number;
  registeredCount: number;
  organizerId: ObjectId;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Schema configuration
{
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
    }
  }
}

// Indexes
organizerId: 1
date: 1
location: 1
{ title: 'text', description: 'text' }

// Virtuals
organizer: Populate from User model

// Methods
hasAvailableCapacity(): boolean {
  return this.registeredCount < this.capacity;
}
```

**Design Decision**: Use text index on title and description for full-text search. Track registeredCount directly on Event for efficient capacity checks without counting registrations. Add virtual for organizer to simplify population.

### Registration Model

```typescript
interface IRegistration {
  _id: ObjectId;
  eventId: ObjectId;
  userId: ObjectId;
  status: 'confirmed' | 'cancelled';
  registeredAt: Date;
}

// Schema configuration
{
  timestamps: false,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
    }
  }
}

// Indexes
{ eventId: 1, userId: 1 }: { unique: true }
eventId: 1
userId: 1
status: 1

// Virtuals
event: Populate from Event model
user: Populate from User model
```

**Design Decision**: Compound unique index on eventId+userId prevents duplicate registrations. Use status field instead of soft delete to maintain registration history. Separate indexes on eventId and userId for efficient queries.

### RefreshToken Model

```typescript
interface IRefreshToken {
  _id: ObjectId;
  userId: ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

// Schema configuration
{
  timestamps: { createdAt: true, updatedAt: false }
}

// Indexes
token: { unique: true }
userId: 1
expiresAt: { expireAfterSeconds: 0 }

// Static methods
cleanupExpired(): Promise<void>
```

**Design Decision**: Use MongoDB TTL index to automatically delete expired tokens. Store token hash for security. Include userId index for efficient user-based queries (e.g., logout all sessions).

## Error Handling

### Error Response Format

```typescript
interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}
```

### Error Handling Flow

1. **Validation Errors**: Caught by validation middleware, formatted with field-level details
2. **Authentication Errors**: JWT verification failures return 401 with clear message
3. **Authorization Errors**: Ownership checks return 403 with clear message
4. **Not Found Errors**: Missing resources return 404
5. **Conflict Errors**: Duplicate registrations, full capacity return 409
6. **Internal Errors**: Unexpected errors return 500, logged with full context

**Design Decision**: Use consistent error format across all endpoints. Provide detailed validation errors for better developer experience. Log all errors with context but hide sensitive information in responses.

## Testing Strategy

### Unit Tests

**Models**:
- Schema validation rules
- Instance methods (comparePassword, hasAvailableCapacity)
- JSON transformation (password exclusion)

**Utilities**:
- JWT generation and verification
- Password hashing and comparison
- Pagination calculations

**Services**:
- Business logic with mocked models
- Transaction handling
- Error conditions

### Integration Tests

**Authentication Flow**:
- Register → Login → Access protected route → Refresh token → Logout
- Invalid credentials handling
- Token expiration handling

**Event Management**:
- Create event → Update event → Delete event
- Authorization checks (only organizer can modify)
- Search and filtering
- Pagination

**Registration Flow**:
- Register for event → Check registration → Cancel registration
- Capacity management
- Duplicate registration prevention
- Transaction rollback on failure

**Error Handling**:
- Validation errors
- Authentication errors
- Authorization errors
- Not found errors
- Conflict errors

### Test Database

Use separate MongoDB database for testing with setup/teardown hooks to ensure clean state between tests.

## Security Considerations

### Authentication & Authorization

- JWT tokens signed with strong secrets
- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days and stored in database for revocation
- Password hashing with bcrypt (10 salt rounds)
- Authorization checks in service layer

### Input Validation

- Zod schemas validate all inputs
- Type-safe validation with TypeScript inference
- Sanitize inputs to prevent XSS
- Parameterized queries prevent injection

### Rate Limiting

- 100 requests per 15 minutes for general API
- 5 requests per 15 minutes for auth endpoints
- Per-IP address tracking

### Security Headers

- Helmet middleware for security headers
- CORS configured with allowed origins
- Content Security Policy

### Data Protection

- Passwords never returned in responses
- Sensitive data excluded from logs
- Environment variables for secrets

## Performance Optimizations

### Database Indexes

- Unique indexes on email, token
- Compound index on eventId+userId
- Text index on title+description
- Individual indexes on frequently queried fields

### Query Optimization

- Use lean() for read-only queries
- Populate only necessary fields
- Limit populated depth
- Use projection to exclude unnecessary fields

### Connection Pooling

Configure Mongoose connection pool for concurrent requests

### Pagination

- Default limit of 10, maximum 100
- Cursor-based pagination for large datasets (future enhancement)

## Deployment Considerations

### Environment Configuration

- Separate configs for development, staging, production
- Environment variables for all secrets
- Validation of required environment variables on startup

### Logging

- Structured logging with Winston
- Different log levels per environment
- Log rotation for production
- Request/response logging with sanitization

### Health Checks

- `/api/health`: Basic health check
- `/api/health/db`: Database connection check
- Used by load balancers and monitoring

### Monitoring

- Request duration tracking
- Error rate monitoring
- Database query performance
- Memory and CPU usage

### Scalability

- Stateless authentication (JWT)
- Horizontal scaling ready
- Database connection pooling
- Consider Redis for session storage (future enhancement)

## API Documentation

Swagger/OpenAPI documentation served at `/api-docs` with:
- All endpoints documented
- Request/response schemas
- Authentication requirements
- Example requests and responses
- Error responses

## Future Enhancements

1. **Email Notifications**: Send confirmation emails for registrations
2. **Event Categories**: Add categorization and filtering by category
3. **Image Upload**: Direct image upload instead of URL
4. **Event Updates**: Notify registered users of event changes
5. **Waitlist**: Allow users to join waitlist when event is full
6. **OAuth Integration**: Google OAuth for authentication
7. **Admin Panel**: Administrative interface for user/event management
8. **Analytics**: Event popularity, registration trends
9. **Caching**: Redis for frequently accessed data
10. **WebSockets**: Real-time capacity updates
