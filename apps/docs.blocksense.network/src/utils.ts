import React from 'react';
import ReactDOMServer from 'react-dom/server';

export function createStaticComponent(
  sourceUnitComponent: React.ReactElement,
): string {
  let componentString =
    ReactDOMServer.renderToStaticMarkup(sourceUnitComponent);

  componentString = componentString.replace(/class="/g, 'className="');

  return componentString;
}
