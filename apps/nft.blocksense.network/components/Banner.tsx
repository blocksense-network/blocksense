export const Banner = () => {
  const lastWind =
    '🏴‍☠️ Last wind before we sail! Last chance to mint! Come aboard now or be left dockside watchin’ the tide roll out. ⚓';

  const crewIsBack =
    '🏴‍☠️ The crew’s back on deck and recruitin’ fast! Don’t hesitate, pirate—spots fill quick, and we might need another nap soon.';

  return (
    <div className="sticky top-0 left-0 z-50 overflow-hidden h-[2.375rem] bg-white py-3 flex items-center justify-center">
      <div className="relative overflow-hidden w-full">
        <div className="animate-scroll flex">
          <p className="text-sm text-black font-semibold flex items-center justify-center gap-10">
            {Array.from({ length: 10 }).map((_, index) => (
              <span key={index}>{crewIsBack}</span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
};
