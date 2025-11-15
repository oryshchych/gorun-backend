import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Events Platform API',
      version: '1.0.0',
      description: 'A RESTful API for managing events and registrations with JWT authentication',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.PORT}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token',
        },
      },
      schemas: {
        // User schemas
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'User ID',
              example: '507f1f77bcf86cd799439011',
            },
            name: {
              type: 'string',
              description: 'User full name',
              example: 'John Doe',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'john.doe@example.com',
            },
            image: {
              type: 'string',
              format: 'uri',
              description: 'User profile image URL',
              example: 'https://example.com/avatar.jpg',
            },
            provider: {
              type: 'string',
              enum: ['credentials', 'google'],
              description: 'Authentication provider',
              example: 'credentials',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
        },
        RegisterInput: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: {
              type: 'string',
              minLength: 2,
              maxLength: 50,
              description: 'User full name',
              example: 'John Doe',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'john.doe@example.com',
            },
            password: {
              type: 'string',
              minLength: 8,
              maxLength: 100,
              description: 'User password',
              example: 'SecurePass123!',
            },
          },
        },
        LoginInput: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'john.doe@example.com',
            },
            password: {
              type: 'string',
              description: 'User password',
              example: 'SecurePass123!',
            },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            user: {
              $ref: '#/components/schemas/User',
            },
            accessToken: {
              type: 'string',
              description: 'JWT access token (expires in 15 minutes)',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            refreshToken: {
              type: 'string',
              description: 'JWT refresh token (expires in 7 days)',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
          },
        },
        RefreshTokenInput: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: {
              type: 'string',
              description: 'Refresh token',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
          },
        },
        // Event schemas
        Event: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Event ID',
              example: '507f1f77bcf86cd799439011',
            },
            title: {
              type: 'string',
              description: 'Event title',
              example: 'Tech Conference 2024',
            },
            description: {
              type: 'string',
              description: 'Event description',
              example: 'Annual technology conference featuring industry leaders',
            },
            date: {
              type: 'string',
              format: 'date-time',
              description: 'Event date and time',
              example: '2024-12-15T10:00:00.000Z',
            },
            location: {
              type: 'string',
              description: 'Event location',
              example: 'San Francisco Convention Center',
            },
            capacity: {
              type: 'integer',
              minimum: 1,
              maximum: 10000,
              description: 'Maximum number of attendees',
              example: 500,
            },
            registeredCount: {
              type: 'integer',
              description: 'Current number of registered attendees',
              example: 150,
            },
            organizerId: {
              type: 'string',
              description: 'Event organizer user ID',
              example: '507f1f77bcf86cd799439011',
            },
            organizer: {
              $ref: '#/components/schemas/User',
            },
            imageUrl: {
              type: 'string',
              format: 'uri',
              description: 'Event image URL',
              example: 'https://example.com/event-image.jpg',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Event creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
        },
        CreateEventInput: {
          type: 'object',
          required: ['title', 'description', 'date', 'location', 'capacity'],
          properties: {
            title: {
              type: 'string',
              minLength: 3,
              maxLength: 100,
              description: 'Event title',
              example: 'Tech Conference 2024',
            },
            description: {
              type: 'string',
              minLength: 10,
              maxLength: 2000,
              description: 'Event description',
              example: 'Annual technology conference featuring industry leaders',
            },
            date: {
              type: 'string',
              format: 'date-time',
              description: 'Event date and time (must be in the future)',
              example: '2024-12-15T10:00:00.000Z',
            },
            location: {
              type: 'string',
              minLength: 3,
              maxLength: 200,
              description: 'Event location',
              example: 'San Francisco Convention Center',
            },
            capacity: {
              type: 'integer',
              minimum: 1,
              maximum: 10000,
              description: 'Maximum number of attendees',
              example: 500,
            },
            imageUrl: {
              type: 'string',
              format: 'uri',
              description: 'Event image URL (optional)',
              example: 'https://example.com/event-image.jpg',
            },
          },
        },
        UpdateEventInput: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              minLength: 3,
              maxLength: 100,
              description: 'Event title',
              example: 'Tech Conference 2024',
            },
            description: {
              type: 'string',
              minLength: 10,
              maxLength: 2000,
              description: 'Event description',
              example: 'Annual technology conference featuring industry leaders',
            },
            date: {
              type: 'string',
              format: 'date-time',
              description: 'Event date and time (must be in the future)',
              example: '2024-12-15T10:00:00.000Z',
            },
            location: {
              type: 'string',
              minLength: 3,
              maxLength: 200,
              description: 'Event location',
              example: 'San Francisco Convention Center',
            },
            capacity: {
              type: 'integer',
              minimum: 1,
              maximum: 10000,
              description: 'Maximum number of attendees',
              example: 500,
            },
            imageUrl: {
              type: 'string',
              format: 'uri',
              description: 'Event image URL',
              example: 'https://example.com/event-image.jpg',
            },
          },
        },
        // Registration schemas
        Registration: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Registration ID',
              example: '507f1f77bcf86cd799439011',
            },
            eventId: {
              type: 'string',
              description: 'Event ID',
              example: '507f1f77bcf86cd799439011',
            },
            userId: {
              type: 'string',
              description: 'User ID',
              example: '507f1f77bcf86cd799439011',
            },
            status: {
              type: 'string',
              enum: ['confirmed', 'cancelled'],
              description: 'Registration status',
              example: 'confirmed',
            },
            registeredAt: {
              type: 'string',
              format: 'date-time',
              description: 'Registration timestamp',
            },
            event: {
              $ref: '#/components/schemas/Event',
            },
            user: {
              $ref: '#/components/schemas/User',
            },
          },
        },
        CreateRegistrationInput: {
          type: 'object',
          required: ['eventId'],
          properties: {
            eventId: {
              type: 'string',
              description: 'Event ID to register for',
              example: '507f1f77bcf86cd799439011',
            },
          },
        },
        // Pagination schemas
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              description: 'Current page number',
              example: 1,
            },
            limit: {
              type: 'integer',
              description: 'Items per page',
              example: 10,
            },
            total: {
              type: 'integer',
              description: 'Total number of items',
              example: 100,
            },
            totalPages: {
              type: 'integer',
              description: 'Total number of pages',
              example: 10,
            },
          },
        },
        PaginatedEvents: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Event',
              },
            },
            pagination: {
              $ref: '#/components/schemas/Pagination',
            },
          },
        },
        PaginatedRegistrations: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Registration',
              },
            },
            pagination: {
              $ref: '#/components/schemas/Pagination',
            },
          },
        },
        // Error schemas
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type',
              example: 'ValidationError',
            },
            message: {
              type: 'string',
              description: 'Error message',
              example: 'Validation failed',
            },
            statusCode: {
              type: 'integer',
              description: 'HTTP status code',
              example: 400,
            },
            errors: {
              type: 'object',
              description: 'Field-level validation errors',
              additionalProperties: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              example: {
                email: ['Invalid email format'],
                password: ['Password must be at least 8 characters'],
              },
            },
          },
        },
        SuccessMessage: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Success message',
              example: 'Operation completed successfully',
            },
          },
        },
        HealthCheck: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Health status',
              example: 'ok',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Current timestamp',
            },
            uptime: {
              type: 'number',
              description: 'Server uptime in seconds',
              example: 12345.67,
            },
          },
        },
        CheckRegistrationResponse: {
          type: 'object',
          properties: {
            isRegistered: {
              type: 'boolean',
              description: 'Whether the user is registered for the event',
              example: true,
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
      },
      {
        name: 'Events',
        description: 'Event management endpoints',
      },
      {
        name: 'Registrations',
        description: 'Event registration management endpoints',
      },
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
    ],
    paths: {
      '/api/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          description: 'Check if the API is running',
          responses: {
            200: {
              description: 'API is healthy',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/HealthCheck',
                  },
                },
              },
            },
          },
        },
      },
      '/api/auth/register': {
        post: {
          tags: ['Authentication'],
          summary: 'Register a new user',
          description: 'Create a new user account with email and password',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RegisterInput',
                },
              },
            },
          },
          responses: {
            201: {
              description: 'User registered successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/AuthResponse',
                  },
                },
              },
            },
            400: {
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            409: {
              description: 'Email already exists',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            429: {
              description: 'Too many requests',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Login user',
          description: 'Authenticate user with email and password',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/LoginInput',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/AuthResponse',
                  },
                },
              },
            },
            400: {
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            401: {
              description: 'Invalid credentials',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            429: {
              description: 'Too many requests',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/auth/refresh': {
        post: {
          tags: ['Authentication'],
          summary: 'Refresh access token',
          description: 'Get a new access token using a refresh token',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RefreshTokenInput',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Token refreshed successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/AuthResponse',
                  },
                },
              },
            },
            401: {
              description: 'Invalid or expired refresh token',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/auth/logout': {
        post: {
          tags: ['Authentication'],
          summary: 'Logout user',
          description: 'Invalidate refresh token and logout user',
          security: [
            {
              bearerAuth: [],
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RefreshTokenInput',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Logout successful',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SuccessMessage',
                  },
                },
              },
            },
            401: {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['Authentication'],
          summary: 'Get current user',
          description: 'Get the profile of the currently authenticated user',
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            200: {
              description: 'User profile retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/User',
                  },
                },
              },
            },
            401: {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/events': {
        get: {
          tags: ['Events'],
          summary: 'Get all events',
          description: 'Get a paginated list of events with optional filters',
          parameters: [
            {
              name: 'page',
              in: 'query',
              description: 'Page number',
              schema: {
                type: 'integer',
                minimum: 1,
                default: 1,
              },
            },
            {
              name: 'limit',
              in: 'query',
              description: 'Items per page',
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 10,
              },
            },
            {
              name: 'search',
              in: 'query',
              description: 'Search in title and description',
              schema: {
                type: 'string',
              },
            },
            {
              name: 'startDate',
              in: 'query',
              description: 'Filter events starting from this date',
              schema: {
                type: 'string',
                format: 'date-time',
              },
            },
            {
              name: 'endDate',
              in: 'query',
              description: 'Filter events until this date',
              schema: {
                type: 'string',
                format: 'date-time',
              },
            },
            {
              name: 'location',
              in: 'query',
              description: 'Filter by location',
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            200: {
              description: 'Events retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/PaginatedEvents',
                  },
                },
              },
            },
            400: {
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Events'],
          summary: 'Create a new event',
          description: 'Create a new event (requires authentication)',
          security: [
            {
              bearerAuth: [],
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateEventInput',
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Event created successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Event',
                  },
                },
              },
            },
            400: {
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            401: {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/events/my': {
        get: {
          tags: ['Events'],
          summary: 'Get my events',
          description: 'Get events created by the authenticated user',
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'page',
              in: 'query',
              description: 'Page number',
              schema: {
                type: 'integer',
                minimum: 1,
                default: 1,
              },
            },
            {
              name: 'limit',
              in: 'query',
              description: 'Items per page',
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 10,
              },
            },
          ],
          responses: {
            200: {
              description: 'Events retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/PaginatedEvents',
                  },
                },
              },
            },
            401: {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/events/{id}': {
        get: {
          tags: ['Events'],
          summary: 'Get event by ID',
          description: 'Get detailed information about a specific event',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Event ID',
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            200: {
              description: 'Event retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Event',
                  },
                },
              },
            },
            404: {
              description: 'Event not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
        put: {
          tags: ['Events'],
          summary: 'Update event',
          description: 'Update an event (requires authentication and ownership)',
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Event ID',
              schema: {
                type: 'string',
              },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UpdateEventInput',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Event updated successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Event',
                  },
                },
              },
            },
            400: {
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            401: {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            403: {
              description: 'Forbidden - not the event organizer',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            404: {
              description: 'Event not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ['Events'],
          summary: 'Delete event',
          description: 'Delete an event (requires authentication and ownership)',
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Event ID',
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            204: {
              description: 'Event deleted successfully',
            },
            401: {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            403: {
              description: 'Forbidden - not the event organizer',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            404: {
              description: 'Event not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            409: {
              description: 'Conflict - event has confirmed registrations',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/events/{id}/check-registration': {
        get: {
          tags: ['Events'],
          summary: 'Check registration status',
          description: 'Check if the authenticated user is registered for an event',
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Event ID',
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            200: {
              description: 'Registration status retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/CheckRegistrationResponse',
                  },
                },
              },
            },
            401: {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            404: {
              description: 'Event not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/registrations': {
        get: {
          tags: ['Registrations'],
          summary: 'Get all registrations',
          description: 'Get a paginated list of registrations with optional filters (requires authentication)',
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'page',
              in: 'query',
              description: 'Page number',
              schema: {
                type: 'integer',
                minimum: 1,
                default: 1,
              },
            },
            {
              name: 'limit',
              in: 'query',
              description: 'Items per page',
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 10,
              },
            },
            {
              name: 'eventId',
              in: 'query',
              description: 'Filter by event ID',
              schema: {
                type: 'string',
              },
            },
            {
              name: 'status',
              in: 'query',
              description: 'Filter by status',
              schema: {
                type: 'string',
                enum: ['confirmed', 'cancelled'],
              },
            },
          ],
          responses: {
            200: {
              description: 'Registrations retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/PaginatedRegistrations',
                  },
                },
              },
            },
            401: {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Registrations'],
          summary: 'Create a registration',
          description: 'Register for an event (requires authentication)',
          security: [
            {
              bearerAuth: [],
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateRegistrationInput',
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Registration created successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Registration',
                  },
                },
              },
            },
            400: {
              description: 'Validation error or event is in the past',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            401: {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            404: {
              description: 'Event not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            409: {
              description: 'Already registered or event is full',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/registrations/my': {
        get: {
          tags: ['Registrations'],
          summary: 'Get my registrations',
          description: 'Get registrations for the authenticated user',
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'page',
              in: 'query',
              description: 'Page number',
              schema: {
                type: 'integer',
                minimum: 1,
                default: 1,
              },
            },
            {
              name: 'limit',
              in: 'query',
              description: 'Items per page',
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 10,
              },
            },
          ],
          responses: {
            200: {
              description: 'Registrations retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/PaginatedRegistrations',
                  },
                },
              },
            },
            401: {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/registrations/{id}': {
        delete: {
          tags: ['Registrations'],
          summary: 'Cancel registration',
          description: 'Cancel a registration (requires authentication and ownership)',
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Registration ID',
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            204: {
              description: 'Registration cancelled successfully',
            },
            401: {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            403: {
              description: 'Forbidden - not the registration owner',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            404: {
              description: 'Registration not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/events/{eventId}/registrations': {
        get: {
          tags: ['Registrations'],
          summary: 'Get event registrations',
          description: 'Get registrations for a specific event (requires authentication and event ownership)',
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'eventId',
              in: 'path',
              required: true,
              description: 'Event ID',
              schema: {
                type: 'string',
              },
            },
            {
              name: 'page',
              in: 'query',
              description: 'Page number',
              schema: {
                type: 'integer',
                minimum: 1,
                default: 1,
              },
            },
            {
              name: 'limit',
              in: 'query',
              description: 'Items per page',
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 10,
              },
            },
          ],
          responses: {
            200: {
              description: 'Registrations retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/PaginatedRegistrations',
                  },
                },
              },
            },
            401: {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            403: {
              description: 'Forbidden - not the event organizer',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            404: {
              description: 'Event not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [], // We're using the definition object instead of JSDoc comments
};

export const swaggerSpec = swaggerJsdoc(options);
