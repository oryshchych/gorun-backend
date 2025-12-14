# Development Guide

This guide covers the development workflow, code standards, and best practices for the Events Platform Backend.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- MongoDB (local or Atlas)

### Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up git hooks (optional but recommended)
npx husky install

# Start development server
npm run dev
```

## 📋 Available Scripts

### Development

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm run start        # Start production server
npm run clean        # Remove build artifacts
```

### Code Quality

```bash
npm run type-check   # Check TypeScript types without emitting
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues automatically
npm run format       # Format code with Prettier
npm run format:check # Check if code is formatted
npm run pre-commit   # Run all checks (type, lint, format)
```

### Testing

```bash
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## 🎯 Code Standards

### TypeScript

- **Strict mode enabled**: All TypeScript strict checks are on
- **Explicit return types**: Functions should have explicit return types
- **No `any` types**: Use proper typing instead of `any`
- **Null safety**: Use optional chaining and nullish coalescing

### Code Style

- **Prettier**: Automatic code formatting
- **ESLint**: Code linting with TypeScript rules
- **Import order**: Imports are automatically sorted
- **Consistent naming**: Use camelCase for variables, PascalCase for classes

### File Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── middleware/      # Express middleware
├── models/          # Database models
├── routes/          # Route definitions
├── services/        # Business logic
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
├── validators/      # Input validation schemas
└── tests/           # Test files
```

## 🧪 Testing Strategy

### Unit Tests

- Test individual functions and classes
- Mock external dependencies
- Focus on business logic

### Integration Tests

- Test API endpoints
- Use in-memory MongoDB for database tests
- Test middleware and error handling

### Test Structure

```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup for each test
  });

  it('should do something specific', async () => {
    // Arrange
    const input = {
      /* test data */
    };

    // Act
    const result = await functionUnderTest(input);

    // Assert
    expect(result).toEqual(expectedOutput);
  });
});
```

## 🔧 Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes
# Write tests
# Ensure all checks pass
npm run pre-commit

# Commit changes
git commit -m "feat: add new feature"
```

### 2. Code Review Checklist

- [ ] TypeScript types are properly defined
- [ ] Tests are written and passing
- [ ] Code is formatted and linted
- [ ] No console.log statements in production code
- [ ] Error handling is implemented
- [ ] Documentation is updated

### 3. Pre-commit Hooks

Automatically runs on `git commit`:

- TypeScript type checking
- ESLint with auto-fix
- Prettier formatting
- Only staged files are processed

## 📝 Code Examples

### Controller Pattern

```typescript
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { SomeService } from '../services/some.service';

export const getSomething = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const result = await SomeService.findById(id);

  res.status(200).json({
    success: true,
    data: result,
  });
});
```

### Service Pattern

```typescript
import { SomeModel } from '../models/Some';
import { NotFoundError } from '../types/errors';

export class SomeService {
  static async findById(id: string): Promise<SomeDocument> {
    const item = await SomeModel.findById(id);

    if (!item) {
      throw new NotFoundError('Item not found');
    }

    return item;
  }
}
```

### Error Handling

```typescript
import { AppError } from '../types/errors';

// Custom error classes
export class ValidationError extends AppError {
  constructor(message: string, errors?: Record<string, string[]>) {
    super(message, 400, 'ValidationError', errors);
  }
}

// Usage in controllers
if (!isValid) {
  throw new ValidationError('Invalid input', {
    email: ['Email is required'],
  });
}
```

## 🔍 Debugging

### Development Debugging

```bash
# Enable debug logs
LOG_LEVEL=debug npm run dev

# Use Node.js debugger
node --inspect-brk -r ts-node/register src/server.ts
```

### Production Debugging

- Check Railway/Render logs
- Monitor error rates
- Use structured logging with Winston

## 🚨 Common Issues

### TypeScript Errors

```bash
# Clear TypeScript cache
rm -rf dist/
npm run clean
npm run build
```

### ESLint Issues

```bash
# Fix automatically
npm run lint:fix

# Disable specific rules (use sparingly)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = response;
```

### Import Issues

```bash
# Check import paths
# Use absolute imports from src/
import { logger } from '../config/logger'; // ✅ Good
import logger from '../../config/logger';  // ❌ Avoid
```

## 📊 Performance Best Practices

### Database

- Use indexes for frequently queried fields
- Implement pagination for large datasets
- Use MongoDB aggregation for complex queries
- Monitor query performance

### API

- Implement rate limiting
- Use compression middleware
- Cache frequently accessed data
- Validate input early

### Memory

- Avoid memory leaks in event listeners
- Use streams for large file processing
- Monitor memory usage in production

## 🔐 Security Best Practices

### Authentication

- Use strong JWT secrets
- Implement token rotation
- Validate all inputs
- Use HTTPS in production

### Database

- Use parameterized queries (Mongoose handles this)
- Implement proper access controls
- Sanitize user inputs
- Regular security updates

## 📚 Resources

### Documentation

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/)
- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)

### Tools

- [ESLint Rules](https://eslint.org/docs/rules/)
- [Prettier Configuration](https://prettier.io/docs/en/configuration.html)
- [Husky Git Hooks](https://typicode.github.io/husky/)

## 🤝 Contributing

1. Follow the established code standards
2. Write tests for new features
3. Update documentation
4. Ensure all checks pass before committing
5. Create meaningful commit messages

### Commit Message Format

```
type(scope): description

feat(auth): add password reset functionality
fix(events): resolve date validation issue
docs(api): update endpoint documentation
test(users): add integration tests
```

---

**Happy coding! 🎉**
