import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
          Blocksense Explorer
        </h1>
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-[3rem]">
          Great things are coming soon...
        </h2>
      </div>
      <Link className="text-2xl hover:underline" href="/people">
        Show me the people
      </Link>
      <Link className="text-2xl hover:underline" href="/planets">
        Show me the planets
      </Link>
    </>
  );
}
