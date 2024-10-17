// import { revalidatePath } from 'next/cache';
import DataLayout from '@/components/DataLayout';
import { getData } from '@/lib/getData';

type Person = {
  name: string;
};

type People = { results: Person[] };

// Revalidating the data for the entire file when there are multiple fetching functions within the file.
// export const revalidate = 10;
// export const dynamic = 'force-dynamic';
// export const dynamic = 'force-static';

export default async function People() {
  const people: People = await getData(
    new URL('https://swapi.dev/api/people/'),
    // 'no-store',
  );
  // console.log(people);

  // If I change the data somewehere(adding some new data in the DB) --> Server Actions('use server')
  // I revalidate some piece of the cache on demand
  // revalidatePath('people', 'layout');

  return (
    <>
      <h1 className="text-2xl">These are the people</h1>
      <DataLayout data={people} />
    </>
  );
}
