declare module 'ejs' {
  export interface Options {
    cache?: boolean;
    filename?: string;
    rmWhitespace?: boolean;
    root?: string | string[];
    context?: any;
  }
  export function render(
    template: string,
    data?: any,
    options?: Options,
  ): string;
  const _default: { render: typeof render };
  export default _default;
}
