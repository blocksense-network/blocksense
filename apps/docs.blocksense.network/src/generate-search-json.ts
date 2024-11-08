import fs from 'fs';
import path from 'path';
import FlexSearch from 'flexsearch';
import * as cheerio from 'cheerio';

type DataEntry = {
  title: string;
  data: Record<string, string>;
};

type NextraData = {
  [url: string]: DataEntry;
};

const index = new FlexSearch.Document({
  document: {
    id: 'id',
    index: ['title', 'content'],
    store: ['title', 'content', 'url'],
  },
});

const pagesDirectory = path.join(
  process.cwd(),
  '.next/server/pages/docs/architecture',
);

const generateIndex = async () => {
  const filenames = fs.readdirSync(pagesDirectory);

  filenames.forEach((filename, id) => {
    if (filename.endsWith('.html')) {
      const filePath = path.join(pagesDirectory, filename);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const $ = cheerio.load(fileContents);

      const title = $('title').text();
      // console.log(`${title}\n`);
      const content = $('body').text();
      // console.log(`${content}\n`);
      // console.log('--------------------');

      index.add({
        id,
        title,
        content,
        url: `/${filename.replace(/\.html$/, '')}`,
      });
    }
  });

  try {
    const indexData: NextraData = {};
    await index.export((id, value) => {
      console.log(id);
      console.log(value);
      console.log('--------------');
      // const { title, content, url } = value as {
      //   title: string;
      //   content: string;
      //   url: string;
      // };
      // if (!indexData[url]) {
      //   indexData[url] = { title, data: {} };
      // }
      // indexData[url].data[id] = content;
    });
    fs.writeFileSync(
      path.join(process.cwd(), 'public', 'search-index.json'),
      JSON.stringify(indexData, null, 2),
    );
    console.log('Index exported successfully');
  } catch (error) {
    console.error('Error exporting index:', error);
  }
};

generateIndex().catch(console.error);
