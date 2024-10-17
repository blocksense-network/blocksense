// import { revalidatePath } from 'next/cache';
import { getData } from '@/lib/getData';

type Planet = {
  name: string;
  diameter: number;
};

// Revalidating the data for the entire file when there are multiple fetching functions within the file.
// export const revalidate = 10;
// export const dynamic = 'force-dynamic';
// export const dynamic = 'force-static';

export default async function Planets({
  params,
}: {
  params: { planet: number };
}) {
  const planet: Planet = await getData(
    new URL(`https://swapi.dev/api/planets/${params.planet}`),
  );

  // If I change the data somewehere(adding some new data in the DB) --> Server Actions('use server')
  // I revalidate some piece of the cache on demand
  // revalidatePath('planet', 'layout');

  return (
    <>
      <h1 className="text-2xl">This is the diameter of the planet</h1>
      {planet.diameter}
    </>
  );
}
