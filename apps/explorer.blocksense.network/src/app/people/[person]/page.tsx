// import { revalidatePath } from 'next/cache';
import { getData } from '@/lib/getData';

type Person = {
  name: string;
  height: number;
};

// Revalidating the data for the entire file when there are multiple fetching functions within the file.
// export const revalidate = 10;
// export const dynamic = 'force-dynamic';
// export const dynamic = 'force-static';

export default async function Person({
  params,
}: {
  params: { person: number };
}) {
  const person: Person = await getData(
    new URL(`https://swapi.dev/api/people/${params.person}`),
  );

  // If I change the data somewehere(adding some new data in the DB) --> Server Actions('use server')
  // I revalidate some piece of the cache on demand
  // revalidatePath('person', 'layout');

  return (
    <>
      <h1 className="text-2xl">This is the height of the person</h1>
      {person.height}
    </>
  );
}
