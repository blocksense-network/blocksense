'use client';

interface RestaurantCardProps {
  name: string;
  description: string;
}

export const RestaurantCard = ({ name, description }: RestaurantCardProps) => {
  return (
    <article className="bg-white shadow-lg rounded-lg p-6 m-4 max-w-sm hover:shadow-xl transition-shadow duration-300 ease-in-out">
      <header className="mb-4">
        <h2 className="text-2xl font-semibold text-gray-800">{name}</h2>
      </header>
      <section>
        <p className="text-gray-600 text-base leading-relaxed">{description}</p>
      </section>
    </article>
  );
};
