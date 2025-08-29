# Tracil Frontend

AI-powered clinical data lineage platform frontend built with Next.js 15.4.6, React 19.1.0, and TypeScript.

## Prerequisites

- **Node.js**: >= 18.0.0 (LTS version recommended)
- **npm**: >= 9.0.0 (comes with Node.js)

## Installation

### 1. Install Dependencies

```bash
# Navigate to frontend directory
cd frontend

# Install all dependencies
npm install

# Verify installation
npm run type-check
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your configuration
# (API endpoints, etc.)
```

### 3. Development

```bash
# Start development server
npm run dev

# Open http://localhost:3000
```

## Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report
- `npm run test:a11y` - Run accessibility tests
- `npm run type-check` - TypeScript type checking

## Project Structure

```
frontend/
├── app/                    # Next.js App Router
├── components/            # Reusable UI components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility functions and configurations
├── types/                 # TypeScript type definitions
├── tests/                 # Test files
└── public/                # Static assets
```

## Key Dependencies

- **Next.js 15.4.6** - React framework
- **React 19.1.0** - UI library
- **TypeScript 5.6+** - Type safety
- **Tailwind CSS 4** - Styling
- **ReactFlow 11.11.4** - Graph visualization
- **Jest + Testing Library** - Testing framework
- **ESLint + Accessibility** - Code quality

## Troubleshooting

### Common Issues

1. **Dependencies not found**
   ```bash
   # Clear node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **TypeScript errors**
   ```bash
   # Check types
   npm run type-check
   
   # Clear TypeScript cache
   rm -rf .next tsconfig.tsbuildinfo
   ```

3. **Build failures**
   ```bash
   # Clear build cache
   rm -rf .next
   npm run build
   ```

### Node Version Issues

If you encounter Node.js version issues:

```bash
# Use nvm to switch Node versions
nvm use 18

# Or install the correct version
nvm install 18
nvm use 18
```

## Testing

The project includes comprehensive testing:

- **Unit Tests**: Component and utility testing
- **Accessibility Tests**: WCAG 2.2 AA compliance
- **Integration Tests**: End-to-end workflows
- **Type Safety**: Full TypeScript coverage

Run tests with:
```bash
npm run test              # All tests
npm run test:a11y        # Accessibility only
npm run test:coverage    # Coverage report
```

## Accessibility

This project maintains WCAG 2.2 AA compliance:

- Keyboard navigation support
- Screen reader compatibility
- Proper ARIA labels and roles
- Color contrast compliance
- Focus management

## Contributing

1. Follow TypeScript strict mode
2. Maintain accessibility standards
3. Write comprehensive tests
4. Use conventional commits
5. Update documentation for schema changes

## Support

For issues or questions:
1. Check this README
2. Review test files for examples
3. Check TypeScript definitions
4. Run accessibility tests
