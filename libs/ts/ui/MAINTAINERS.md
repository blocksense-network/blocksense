# @blocksense/ui - Maintainer Documentation

## Publishing to NPM

### Prerequisites

1. **NPM Account Access**: Ensure you have publishing rights to the `@blocksense` npm organization
2. **Authentication**: Login to npm with appropriate credentials
   ```bash
   npm login
   ```

### Publishing Process

#### Just Target (Recommended)

Run `just publish-ui <version-bump>`, where `version-bump` is one of `patch` (default), `minor` or `major`.

#### Manual Process

##### 1. Version Management

Update the version in `package.json`:

```bash
# For patch releases (bug fixes)
npm version patch

# For minor releases (new features)
npm version minor

# For major releases (breaking changes)
npm version major
```

##### 2. Build the Package

```bash
# Build the package
just build-ts @blocksense/ui

# Or manually build
yarn build-tailwind
```

##### 3. Publish to NPM

```bash
# Publish to npm
npm publish

# Or for beta/alpha releases
npm publish --tag beta
npm publish --tag alpha
```

## Package Structure

The package exports components in multiple ways:

- **Main export**: `import { Button, Card } from '@blocksense/ui'`
- **Individual exports**: `import { Button } from '@blocksense/ui/Button'`
- **Styles**: `import '@blocksense/ui/style.css'` or `import '@blocksense/ui/globals.css'`

## Development Workflow

### Local Development

```bash
# Start Storybook for component development
yarn storybook

# Build CSS
yarn build-tailwind
```

### Testing Components

- All components have Storybook stories in `*.stories.tsx` files
- Run Storybook locally to test components before publishing

### Dependencies

- The package requires peer dependencies: `react`, `react-dom`, `next`, `@types/react`
- Uses Tailwind CSS for styling

## Release Checklist

- [ ] Update component documentation in Storybook
- [ ] Test components in Storybook
- [ ] Build package successfully
- [ ] Update version appropriately
- [ ] Publish to NPM
- [ ] Update dependent projects
- [ ] Create release notes

## Troubleshooting

### Common Issues

1. **Build Failures**: Ensure Tailwind CSS is properly configured
2. **Peer Dependency Warnings**: Verify all peer deps are compatible
3. **Import Errors**: Check that all exports are properly defined in `package.json`

### Support

For questions about publishing or maintenance, refer to the main project documentation or create an issue in the repository.
