import type { Metadata } from 'next';

import { nftDropConfig } from '../config';
import { Hero } from 'components/Hero';
import { Form } from 'components/Form';
import { CTA } from 'components/CTA';
import { About } from 'components/About';
import { ProductFeatures } from 'components/ProductFeatures';
import { RestaurantCard } from 'components/Restaurant';
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

const NFTDropPage = async () => {
  const restaurants = await fetchRestaurants();
  return (
    <>
      <Hero />
      <Form />
      <About />
      <CTA />

      {/* Implement scrolling animation using Motion */}
      <ProductFeatures />
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
    </>
  );
};

export default NFTDropPage;
