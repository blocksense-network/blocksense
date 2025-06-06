# @blocksense/ui

A comprehensive React component library built with TypeScript and Tailwind CSS, designed for Blocksense-branded modern web applications.

## 🚀 Features

- **30+ React Components** - Buttons, Forms, Navigation, Data Display, and more
- **TypeScript Support** - Fully typed components with excellent IntelliSense
- **Tailwind CSS** - Modern utility-first styling with dark mode support
- **Storybook Documentation** - Interactive component playground
- **Modular Imports** - Import only what you need
- **Accessibility** - WCAG compliant components
- **Customizable** - Easy theming and style overrides

## 📦 Installation

### Option 1: Local Development (Current)

Since this package is not yet published to NPM, you can use it locally in a few ways:

#### A. Yarn/NPM Link (Recommended for development)

1. **In the blocksense repository:**

```bash
cd libs/ts/ui
npm link
# or
yarn link
```

2. **In your project:**

```bash
npm link @blocksense/ui
# or
yarn link @blocksense/ui
```

#### B. File Path Installation

In your project's `package.json`:

```json
{
  "dependencies": {
    "@blocksense/ui": "file:../path/to/blocksense/libs/ts/ui"
  }
}
```

#### C. Git Submodule + Workspace

Add the blocksense repository as a git submodule and set up a workspace configuration:

1. **Add as git submodule:**

```bash
# In your project root
git submodule add https://github.com/blocksense-network/blocksense.git external/blocksense
git submodule update --init --recursive
```

2. **Set up workspace in your `package.json`:**

```json
{
  "name": "my-project",
  "workspaces": ["packages/*", "external/blocksense/libs/ts/ui"],
  "dependencies": {
    "@blocksense/ui": "workspace:*"
  }
}
```

3. **Install dependencies:**

```bash
yarn install
```

4. **Build the UI library:**

```bash
cd external/blocksense/libs/ts/ui
yarn build-tailwind
```

This approach is useful when you want to:

- Keep the UI library source code in your project
- Make local modifications if needed
- Ensure version consistency across your team

### Option 2: NPM Installation (Future)

> **Note**: This package will be published to NPM in the future. Once published, you can install it normally:

```bash
npm install @blocksense/ui
# or
yarn add @blocksense/ui
```

## 🎯 Quick Start

### 1. Install Required Peer Dependencies

```bash
npm install react react-dom next @types/react
# or
yarn add react react-dom next @types/react
```

### 2. Import Styles

Add the CSS import to your main CSS file or layout:

```css
/* Option 1: Pre-built styles */
@import '@blocksense/ui/style.css';

/* Option 2: Global styles (if you want to customize) */
@import '@blocksense/ui/globals.css';
```

### 3. Use Components

```tsx
import { Button, Card, CardHeader, CardContent } from '@blocksense/ui';

export default function MyApp() {
  return (
    <Card>
      <CardHeader>
        <h2>Welcome to Blocksense UI</h2>
      </CardHeader>
      <CardContent>
        <Button variant="action" size="lg">
          Get Started
        </Button>
      </CardContent>
    </Card>
  );
}
```

## 📚 Available Components

### Form & Input

- `Button` - Versatile button component with multiple variants
- `Input` - Text input with validation states
- `TextArea` - Multi-line text input
- `Label` - Form labels with proper accessibility
- `Form` - Form wrapper with validation
- `Checkbox` - Checkbox input component
- `RadioGroup` - Radio button groups
- `Select` - Dropdown select component
- `Switch` - Toggle switch component
- `Slider` - Range slider input

### Layout & Navigation

- `Card` - Flexible card container
- `Tabs` - Tabbed navigation component
- `Accordion` - Collapsible content sections
- `Dialog` - Modal dialog component
- `Drawer` - Slide-out panel component
- `DropdownMenu` - Contextual menu component
- `Separator` - Visual content separator

### Data Display

- `Table` - Basic table components (Table, TableHeader, TableBody, etc.)
- `Badge` - Status and category badges
- `ProgressBar` - Progress indication
- `Carousel` - Image/content carousel
- `Icon` - Icon component system
- `ImageWrapper` - Optimized image component

### Feedback & Overlays

- `Callout` - Highlighted information blocks
- `InfoTip` - Contextual information tooltips
- `Tooltip` - Hover tooltips
- `CopyButton` - One-click copy functionality

### Advanced

- `Command` - Command palette / search interface
- `Popover` - Floating content containers
- `ScrollArea` - Custom scrollable areas

## 🎨 Component Usage Examples

### Button Component

```tsx
import { Button } from '@blocksense/ui/Button';

// Basic usage
<Button>Click me</Button>

// With variants
<Button variant="action">Action</Button>
<Button variant="danger">Danger</Button>
<Button variant="outline">Outline</Button>
<Button variant="highlight">Highlight</Button>
<Button variant="transparent">Transparent</Button>
<Button variant="link">Link</Button>

// With sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>
<Button size="xl">Extra Large</Button>
<Button size="icon">🔥</Button>

// Disabled state
<Button disabled>Disabled</Button>
```

### Card Component

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@blocksense/ui/Card';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Card content goes here...</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>;
```

### Form Components

```tsx
import { Form, Label, Input, Button } from '@blocksense/ui';

<Form onSubmit={handleSubmit}>
  <div>
    <Label htmlFor="email">Email</Label>
    <Input id="email" type="email" placeholder="Enter your email" required />
  </div>
  <Button type="submit">Submit</Button>
</Form>;
```

## 🛠 Import Strategies

### Individual Imports (Recommended)

```tsx
import { Button } from '@blocksense/ui/Button';
import { Card } from '@blocksense/ui/Card';
```

### Barrel Imports

```tsx
import { Button, Card, Input } from '@blocksense/ui';
```

### Utility Imports

```tsx
import { cn } from '@blocksense/ui/utils';
```

## 🎨 Styling & Customization

### Tailwind CSS Configuration

Make sure your `tailwind.config.js` includes the component library:

```js
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@blocksense/ui/**/*.{js,ts,jsx,tsx}', // Add this line
  ],
  theme: {
    extend: {
      // Your custom theme
    },
  },
  plugins: [],
};
```

### Custom Styling

All components accept a `className` prop for custom styling:

```tsx
<Button className="my-custom-class bg-purple-500 hover:bg-purple-600">
  Custom Button
</Button>
```

### Dark Mode

Components automatically support dark mode when using Tailwind's dark mode:

```js
// tailwind.config.js
module.exports = {
  darkMode: 'class', // or 'media'
  // ...
};
```

## 📖 Documentation

### Storybook

To view all components and their variations:

```bash
# In the blocksense repository
cd libs/ts/ui
yarn storybook
```

This will open an interactive Storybook at `http://localhost:6006` where you can:

- Browse all components
- See usage examples
- Test different props and states
- Copy code snippets

### TypeScript Support

All components are fully typed. Your editor will provide:

- IntelliSense for props
- Type checking
- Documentation tooltips

## 🔧 Development Setup

### Prerequisites

- Node.js 18+
- Yarn or NPM
- React 18+
- Next.js 14+ (for full compatibility)

### Local Development

1. **Clone the blocksense repository**
2. **Install dependencies:**
   ```bash
   yarn install
   ```
3. **Start Storybook for development:**
   ```bash
   cd libs/ts/ui
   yarn storybook
   ```

## 🤝 Contributing

We welcome contributions to the component library! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**
3. **Add or modify components**
4. **Update Storybook stories**
5. **Test your changes**
6. **Submit a pull request**

### Component Development Guidelines

- Follow existing component patterns
- Include TypeScript types
- Add Storybook stories
- Ensure accessibility compliance
- Test with both light and dark modes

## 📋 Requirements

### Peer Dependencies

- `react`: ^18.3.1
- `react-dom`: ^18.3.1
- `next`: \* (optional, for Next.js features)
- `@types/react`: ^18.0.0

### Dependencies

- `tailwindcss`: ^4.0.7
- `clsx`: ^2.1.1
- `tailwind-merge`: ^2.6.0
- And more (see package.json)

## 🚨 Troubleshooting

### Common Issues

**1. Styles not loading**

- Ensure you've imported the CSS file
- Check your Tailwind configuration includes the library path

**2. TypeScript errors**

- Make sure you have the correct peer dependencies installed
- Verify your tsconfig.json includes the necessary types

**3. Components not rendering**

- Check that all peer dependencies are installed
- Ensure you're using compatible React/Next.js versions

**4. Build errors**

- Make sure your bundler supports CSS imports
- Check for conflicting Tailwind versions

### Getting Help

- Check the [Storybook documentation](http://localhost:6006) when running locally
- Review component source code in `libs/ts/ui/src/components/`
- Create an issue in the main blocksense repository

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../../LICENSE) file for details.

## 🔗 Links

- [Blocksense Repository](https://github.com/blocksense-network/blocksense)
- [Documentation Site](https://docs.blocksense.network)
- [Component Storybook](http://localhost:6006) (when running locally)

---

Built with ❤️ by the Blocksense team
