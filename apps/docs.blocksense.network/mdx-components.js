import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs';

// Get the default MDX components from Nextra Docs theme
const docsComponents = getDocsMDXComponents();

// Merge custom components with default Nextra components
export function useMDXComponents(components) {
  return {
    ...docsComponents,
    ...components,
  };
}
