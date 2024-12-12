import 'server-only';

type ApiUrl = URL;

// Different options for Data Caching
// Requests are always memoized
type Caching =
  | 'default'
  | 'force-cache'
  | 'no-cache'
  | 'no-store'
  | 'only-if-cached'
  | 'reload';

type FetchOptions = {
  cache?: Caching;
  next?: {
    revalidate?: number;
  };
};

export async function getData<T>(
  url: ApiUrl,
  cacheOption: Caching = 'default',
  revalidateSec?: number,
): Promise<T> {
  const fetchOptions: FetchOptions = {
    cache: cacheOption,
  };

  if (revalidateSec !== undefined) {
    fetchOptions.next = { revalidate: revalidateSec };
  }

  try {
    const response = await fetch(url.toString(), fetchOptions);

    if (!response.ok) {
      throw new Error(`Failed to fetch the data! Status: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}
