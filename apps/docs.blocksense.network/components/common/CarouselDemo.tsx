import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../carouselCode/CarouselFinal';

export const CarouselHorizontal = () => {
  return (
    <Carousel>
      <CarouselContent>
        <CarouselItem>
          <div className="flex items-center justify-center w-48 h-48 border border-gray-300">
            1
          </div>
        </CarouselItem>
        <CarouselItem>
          <div className="flex items-center justify-center w-48 h-48 border border-gray-300">
            2
          </div>
        </CarouselItem>
        <CarouselItem>
          <div className="flex items-center justify-center w-48 h-48 border border-gray-300">
            3
          </div>
        </CarouselItem>
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
};

export const CarouselHorizontalMany = () => {
  return (
    <Carousel>
      <CarouselContent className="w-[200%]">
        <CarouselItem className="basis-1/3">
          <div className="flex items-center justify-center w-48 h-48 border border-gray-300">
            1
          </div>
        </CarouselItem>
        <CarouselItem className="basis-1/3">
          <div className="flex items-center justify-center w-48 h-48 border border-gray-300">
            2
          </div>
        </CarouselItem>
        <CarouselItem className="basis-1/3">
          <div className="flex items-center justify-center w-48 h-48 border border-gray-300">
            3
          </div>
        </CarouselItem>
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
};

export const CarouselVertical = () => {
  return (
    <Carousel orientation="vertical">
      <CarouselContent className="h-[400px]">
        <CarouselItem>
          <div className="flex items-center justify-center w-48 h-48 border border-gray-300">
            1
          </div>
        </CarouselItem>
        <CarouselItem>
          <div className="flex items-center justify-center w-48 h-48 border border-gray-300">
            2
          </div>
        </CarouselItem>
        <CarouselItem>
          <div className="flex items-center justify-center w-48 h-48 border border-gray-300">
            3
          </div>
        </CarouselItem>
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
};
