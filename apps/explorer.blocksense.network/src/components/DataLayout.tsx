import Link from 'next/link';

type DataType = { results: Array<{ name: string }> };

export default function DataLayout({ data }: { data: DataType }) {
  const hrefForLink: string = data.results[0]!.hasOwnProperty('rotation_period')
    ? '/planets'
    : '/people';

  return (
    <div>
      {data.results.map((d, index) => (
        <p key={index}>
          <Link
            className="hover:underline"
            href={`${hrefForLink}/${index + 1}`}
            key={index}
          >
            {d.name}
          </Link>
        </p>
      ))}
    </div>
  );
}
