/**
 * Generates an HTML string representing the provided code snippet with syntax highlighting.
 *
 * This function uses the `shiki` library to convert the code snippet into an HTML string with syntax highlighting.
 * The language and theme for the syntax highlighting can be specified.
 *
 * @param {string} code - The code snippet to be converted into HTML.
 * @param {string} [lang='text'] - The language of the code snippet. Default is 'text'.
 * @param {string} [theme='material-theme-lighter'] - The theme for the syntax highlighting. Default is 'material-theme-lighter'.
 *
 * @returns {Promise<string>} A promise that resolves with the HTML string representing the highlighted code snippet.
 */
export async function generateCodeSnippetHTML(
  code: string,
  lang: string = 'text',
  theme: string = 'material-theme-lighter',
): Promise<string> {
  const { codeToHtml } = await import('shiki');
  return await codeToHtml(code, {
    lang,
    theme,
  });
}
