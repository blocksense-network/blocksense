import type { Metadata } from 'next';
import { WebflowClient } from 'webflow-api';

import { nftDropConfig } from '../config';
import { Hero } from 'components/Hero';
import { Form } from 'components/Form';
import { CTA } from 'components/CTA';
import { About } from 'components/About';
import { ProductFeatures } from 'components/ProductFeatures';
import { RestaurantCard } from 'components/Restaurant';
import Image from 'next/image';

export const metadata: Metadata = {
  title: nftDropConfig.title,
};

interface Restaurant {
  id: number;
  Name: string;
  Description: [{ children: { text: string }[] }];
}

interface StrapiResponse {
  data: Restaurant[];
}

async function fetchRestaurants(): Promise<Restaurant[]> {
  try {
    const response = await fetch(
      'https://committed-leader-b1fec36dd8.strapiapp.com/api/restaurants',
      {
        // Optional: Add headers if needed, e.g., for authorization
        // headers: {
        //   'Authorization': `Bearer YOUR_API_TOKEN_IF_NEEDED`,
        // },
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      console.error(
        `Error fetching restaurants: ${response.status} ${response.statusText}`,
      );
      return [];
    }

    const data: StrapiResponse = await response.json();
    console.log('Fetched restaurants:', data.data);
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch restaurants:', error);
    return [];
  }
}

const client = new WebflowClient({
  accessToken:
    'b6396dbc6e06266ac2d4751168c1fadcd5dec82853788eb53ca653a440537642',
});
console.log(client);
const NFTDropPage = async () => {
  const restaurants = await fetchRestaurants();
  console.log('Fetched restaurants:', restaurants);

  const authInfo = await client.token.introspect();
  console.log('Auth Info:', authInfo);

  const listSites = await client.sites.list();
  console.log('List of sites:', listSites);

  const listPages = await client.pages.list('68482e96eead80a213c81c56');
  console.log('List of pages:', listPages);

  const aboutPage = await client.pages.getContent('68482e97eead80a213c81cca');
  console.log('Fetched page:', aboutPage);

  const homePage = await client.pages.getContent('68482e97eead80a213c81cc7');
  console.log('Home page:', homePage);

  return (
    <>
      <Hero />
      <Form />
      <About />
      <CTA />

      {/* Implement scrolling animation using Motion */}
      <ProductFeatures />

      {/* Render data from the Strapi API */}
      <section className="flex items-center justify-center gap-7">
        {restaurants.length > 0 &&
          restaurants.map(restaurant => (
            <RestaurantCard
              key={restaurant.id}
              name={restaurant.Name}
              description={restaurant.Description[0]!.children[0]!.text}
            />
          ))}
      </section>

      {/* Render data from the Webflow API */}
      <h1 className="text-3xl font-bold mb-4">About Us Page Content</h1>
      {Array.isArray(aboutPage.nodes) &&
        aboutPage.nodes.map((node: any, idx: number) => {
          // Render text nodes
          if (node.type === 'text' && node.text && node.text.text) {
            return <p key={node.id || idx}>{node.text.text}</p>;
          }
          // Render image nodes (assuming node.image contains image data)
          if (node.type === 'image' && node.image && node.image.url) {
            return (
              <Image
                key={node.id || idx}
                src={node.image.url}
                alt={node.image.alt || 'Image'}
                width={node.image.width || 400}
                height={node.image.height || 300}
              />
            );
          }
          return null;
        })}

      <h1 className="text-3xl font-bold mb-4">Home Page Content</h1>
      {Array.isArray(homePage.nodes) &&
        homePage.nodes.map((node: any, idx: number) => {
          // Render text nodes
          if (node.type === 'text' && node.text && node.text.text) {
            return <p key={node.id || idx}>{node.text.text}</p>;
          }
          // Render image nodes (assuming node.image contains image data)
          if (node.type === 'image' && node.image && node.image.url) {
            return (
              <Image
                key={node.id || idx}
                src={node.image.url}
                alt={node.image.alt || 'Image'}
                width={node.image.width || 400}
                height={node.image.height || 300}
              />
            );
          }
          return null;
        })}
    </>
  );
};

export default NFTDropPage;
