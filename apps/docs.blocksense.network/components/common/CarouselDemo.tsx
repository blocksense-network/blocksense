import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../carouselCode/Carousel';

export const CarouselDemo = () => {
  return (
    <Carousel className="carousel w-full">
      <CarouselContent className="carousel__content">
        <CarouselItem className="carousel__item flex justify-center">
          <div className="flex items-center justify-center w-48 h-48 border border-gray-300">
            1
          </div>
        </CarouselItem>
        <CarouselItem className="carousel__item flex justify-center">
          <div className="flex items-center justify-center w-48 h-48 border border-gray-300">
            2
          </div>
        </CarouselItem>
        <CarouselItem className="carousel__item flex justify-center">
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
