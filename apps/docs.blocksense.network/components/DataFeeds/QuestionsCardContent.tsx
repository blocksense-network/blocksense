import { ImageWrapper } from '@blocksense/docs-ui/ImageWrapper';
import { config } from '@/config';

export const QuestionsCardContent = () => {
  return (
    <div className="">
      <a
        className="flex items-center space-x-2 mb-3"
        href={config.social_media.discord._href}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ImageWrapper
          src="/icons/blocksense-discord.svg"
          alt={config.social_media.discord._alt}
          className="relative w-6 h-6 invert"
        />
        <span className="font-semibold text-gray-900 lg:block dark:text-white">
          Discord
        </span>
      </a>
      <a
        className="flex items-center space-x-2 mb-3"
        href={config.social_media.telegram._href}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ImageWrapper
          src="/icons/blocksense-telegram.svg"
          alt={config.social_media.telegram._alt}
          className="relative w-6 h-6 invert"
        />
        <span className="font-semibold text-gray-900 lg:block dark:text-white">
          Telegram
        </span>
      </a>
      <a
        className="flex items-center space-x-2 mb-3"
        href={config.social_media.x._href}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ImageWrapper
          src="/icons/blocksense-x.svg"
          alt={config.social_media.x._alt}
          className="relative w-6 h-6 invert"
        />
        <span className="font-semibold text-gray-900 lg:block dark:text-white">
          Follow us
        </span>
      </a>
    </div>
  );
};
